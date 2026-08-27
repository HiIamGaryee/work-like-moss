import { NEW_JOINER_MAX_MONTHS } from '@/data/hr-analytics.constants'
import {
  IMPACT_RULES,
  OFFICIAL_ACTION_EXCLUSIONS,
  OFFICIAL_ACTION_IMPACT_MAP,
  classifyComparisonQuality,
  classifyDirection,
  classifyTargetStatus,
  progressTowardTarget,
  type OfficialTargetRule,
} from '@/data/hr-impact-rules'
import { IMPACT_METRICS, type ImpactMetricDefinition, type MetricDirection } from '@/data/hr-metric-rules'
import type { HrAction } from '@/types/hr-actions'
import type { HrAnalytics, PulseTrendPoint } from '@/types/hr-analytics'
import type { Employee, HrDataset, OnboardingSurvey } from '@/types/hr-data'
import type {
  ActionImpact,
  ImpactMeasurement,
  ImpactScope,
  ImpactSummary,
  HrImpactResult,
} from '@/types/hr-impact'
import { average, round } from '@/utils/analytics'
import { isBefore } from '@/utils/date'

/**
 * The impact engine — the measure stage of the decision loop.
 *
 * What it does: takes the baseline a human approved, looks for a later reading
 * of the *same* metric over the *same* population, and reports the movement
 * against the target that human set.
 *
 * What it will not do, by construction:
 *
 *  - **Invent a measurement.** There is no synthetic wave, no projected score
 *    and no "simulate improvement" path. When the workbook holds no later
 *    reading, the answer is `awaiting-measurement`, which is a real result.
 *  - **Recompute history.** The baseline is read from the action record, never
 *    recalculated from today's data, so an approved action's starting point
 *    cannot drift after the fact.
 *  - **Claim causation.** Every generated sentence says a metric moved *after*
 *    an action. Temporal order is not evidence of cause, and no confidence
 *    figure is produced anywhere.
 *  - **Compare mismatched populations.** A division baseline is only ever
 *    compared with that division's later reading.
 */

/* --------------------------------------------------------------- direction */

/**
 * Workload's direction is documented in the workbook and parsed at load time,
 * so the runtime reading wins over the static default. Every other metric is a
 * satisfaction score where higher is better.
 */
function resolveDirection(
  definition: ImpactMetricDefinition,
  analytics: HrAnalytics,
): MetricDirection {
  if (definition.key !== 'pulse-workload') return definition.direction
  const parsed = analytics.pulse.workload.direction
  if (parsed === 'higherIsBetter') return 'higher-is-better'
  if (parsed === 'higherIsWorse') return 'lower-is-better'
  return definition.direction
}

/* ------------------------------------------------------------------- scope */

/** The pulse trend for one workforce slice, or `null` when it has none. */
function pulseTrendForScope(
  scope: ImpactScope,
  analytics: HrAnalytics,
): readonly PulseTrendPoint[] | null {
  if (scope.kind === 'company') return analytics.pulse.trend
  if (scope.kind === 'new-joiners') {
    return analytics.pulse.byTenureBand.find((entry) => entry.group.startsWith('0–'))?.trend ?? null
  }
  if (scope.key === null) return null
  if (scope.kind === 'division') {
    return analytics.pulse.byDivision.find((entry) => entry.group === scope.key)?.trend ?? null
  }
  if (scope.kind === 'employee-group') {
    return analytics.pulse.byEmployeeGroup.find((entry) => entry.group === scope.key)?.trend ?? null
  }
  return analytics.pulse.byTenureBand.find((entry) => entry.group === scope.key)?.trend ?? null
}

/** Onboarding responses belonging to one workforce slice. */
function onboardingRowsForScope(
  scope: ImpactScope,
  dataset: HrDataset,
  employeesById: Map<string, Employee>,
): OnboardingSurvey[] {
  const rows = dataset.onboardingSurveys
  if (scope.kind === 'company') return rows
  if (scope.kind === 'division') return rows.filter((row) => row.division === scope.key)
  if (scope.kind === 'employee-group') return rows.filter((row) => row.employeeGroup === scope.key)
  if (scope.kind === 'new-joiners') {
    return rows.filter((row) => {
      const tenure = employeesById.get(row.employeeId)?.tenureMonths
      return tenure !== undefined && tenure <= NEW_JOINER_MAX_MONTHS
    })
  }
  /* Tenure bands have no onboarding equivalent in this workbook. */
  return []
}

const scopeLabel = (scope: ImpactScope): string =>
  scope.kind === 'company' ? 'company-wide' : (scope.key ?? scope.kind)

/* ------------------------------------------------------------ measurements */

type Reading = { value: number; date: string | null; sampleSize?: number }

/** The most recent pulse wave measured strictly after `afterDate`. */
function latestPulseAfter(
  trend: readonly PulseTrendPoint[] | null,
  definition: ImpactMetricDefinition,
  afterDate: string,
): Reading | null {
  if (!trend || !definition.readPulse) return null

  const eligible = trend.filter((point) => {
    if (point.responseCount === 0 || point.date === null) return false
    /* Strictly after: a wave run on the start date cannot measure the action. */
    if (!isBefore(afterDate, point.date)) return false
    return definition.readPulse?.(point) !== null
  })

  const latest = eligible[eligible.length - 1]
  if (!latest) return null

  const value = definition.readPulse(latest)
  if (value === null) return null
  return { value: round(value, 2), date: latest.date, sampleSize: latest.responseCount }
}

/** The last pulse wave measured on or before `onOrBefore`. */
function pulseAtOrBefore(
  trend: readonly PulseTrendPoint[] | null,
  definition: ImpactMetricDefinition,
  onOrBefore: string,
): Reading | null {
  if (!trend || !definition.readPulse) return null

  const eligible = trend.filter(
    (point) =>
      point.responseCount > 0 &&
      point.date !== null &&
      !isBefore(onOrBefore, point.date) &&
      definition.readPulse?.(point) !== null,
  )

  const last = eligible[eligible.length - 1]
  if (!last) return null

  const value = definition.readPulse(last)
  if (value === null) return null
  return { value: round(value, 2), date: last.date, sampleSize: last.responseCount }
}

/** Mean of onboarding responses on one side of a date boundary. */
function onboardingAcross(
  rows: readonly OnboardingSurvey[],
  definition: ImpactMetricDefinition,
  boundary: string,
  side: 'before' | 'after',
): Reading | null {
  if (!definition.readOnboarding) return null

  const matching = rows.filter((row) =>
    side === 'after' ? isBefore(boundary, row.surveyDate) : isBefore(row.surveyDate, boundary),
  )
  if (matching.length === 0) return null

  const value = average(matching.map((row) => definition.readOnboarding?.(row) ?? null))
  if (value === null) return null

  const dates = matching.map((row) => row.surveyDate).sort()
  return {
    value: round(value, 2),
    date: side === 'after' ? dates[dates.length - 1] : dates[dates.length - 1],
    sampleSize: matching.length,
  }
}

/* ---------------------------------------------------------- interpretation */

const DIRECTION_VERBS = {
  improved: 'moved in the intended direction',
  declined: 'moved against the intended direction',
  unchanged: 'did not move meaningfully',
  unknown: 'could not be compared',
} as const

/**
 * Deterministic prose, generated from the numbers already computed. Every
 * sentence describes what was *observed after* the action — never what the
 * action did.
 */
function buildInterpretation(
  actionStatus: ActionImpact['actionStatus'],
  measurement: ImpactMeasurement | null,
  nextMeasurementLabel: string,
  unmeasurableReason?: string,
): string {
  if (unmeasurableReason) return unmeasurableReason

  if (!measurement || measurement.currentValue === null) {
    const state =
      actionStatus === 'completed'
        ? 'The action is complete, but no later measurement of the target metric is available yet.'
        : 'The action is still in progress and no later measurement of the target metric is available yet.'
    return `${state} ${nextMeasurementLabel} would provide the next reading.`
  }

  const { label, baselineValue, currentValue, targetValue, direction, targetStatus } = measurement
  const from = baselineValue === null ? 'its baseline' : baselineValue.toFixed(2)
  const movement = `${label} ${DIRECTION_VERBS[direction]} after the action began, going from ${from} to ${currentValue.toFixed(2)}`

  if (targetValue === null) {
    return `${movement}. No target was recorded for this action, so there is nothing to compare the result against.`
  }

  const targetPhrase =
    targetStatus === 'met'
      ? `reaching the approved target of ${targetValue.toFixed(2)}`
      : targetStatus === 'partially-met'
        ? `covering part of the distance to the approved target of ${targetValue.toFixed(2)}`
        : `short of the approved target of ${targetValue.toFixed(2)}`

  const caveat =
    measurement.comparisonQuality === 'limited'
      ? ' The later reading rests on a small number of responses, so the comparison is limited.'
      : ''

  return `${movement}, ${targetPhrase}.${caveat}`
}

/* ------------------------------------------------------------ measurement */

type MeasurementInputs = {
  definition: ImpactMetricDefinition
  scope: ImpactScope
  startDate: string
  baseline: Reading | null
  targetValue: number | null
  analytics: HrAnalytics
  dataset: HrDataset
  employeesById: Map<string, Employee>
}

function buildMeasurement({
  definition,
  scope,
  startDate,
  baseline,
  targetValue,
  analytics,
  dataset,
  employeesById,
}: MeasurementInputs): { measurement: ImpactMeasurement | null; reason?: string } {
  const direction = resolveDirection(definition, analytics)

  const current =
    definition.source === 'Pulse Survey'
      ? latestPulseAfter(pulseTrendForScope(scope, analytics), definition, startDate)
      : onboardingAcross(
          onboardingRowsForScope(scope, dataset, employeesById),
          definition,
          startDate,
          'after',
        )

  const label = `${definition.label} · ${scopeLabel(scope)}`

  if (!current) {
    return {
      measurement: {
        label,
        baselineValue: baseline?.value ?? null,
        currentValue: null,
        targetValue,
        unit: 'score',
        baselineDate: baseline?.date ?? null,
        currentDate: null,
        difference: null,
        percentageChange: null,
        direction: 'unknown',
        targetStatus: 'not-measured',
        progressToTarget: null,
        ...(baseline?.sampleSize !== undefined ? { baselineSampleSize: baseline.sampleSize } : {}),
        comparisonQuality: 'not-comparable',
      },
    }
  }

  /* Too few later responses to report a comparison at all. */
  if (
    current.sampleSize !== undefined &&
    current.sampleSize < IMPACT_RULES.minPostActionResponses
  ) {
    return {
      measurement: null,
      reason: `Later ${definition.source} responses exist for ${scopeLabel(scope)}, but only ${current.sampleSize} of them fall after the action started — fewer than the ${IMPACT_RULES.minPostActionResponses} needed before a comparison is reported.`,
    }
  }

  const baselineValue = baseline?.value ?? null
  const difference =
    baselineValue === null ? null : round(current.value - baselineValue, 2)
  const percentageChange =
    baselineValue === null || baselineValue === 0
      ? null
      : round(((current.value - baselineValue) / baselineValue) * 100, 1)

  /* Same metric, same waves, company-wide — context only, never a control. */
  const companyCurrent =
    definition.source === 'Pulse Survey' && scope.kind !== 'company'
      ? latestPulseAfter(analytics.pulse.trend, definition, startDate)
      : null
  const companyBaseline =
    companyCurrent !== null ? pulseAtOrBefore(analytics.pulse.trend, definition, startDate) : null

  return {
    measurement: {
      label,
      baselineValue,
      currentValue: current.value,
      targetValue,
      unit: 'score',
      baselineDate: baseline?.date ?? null,
      currentDate: current.date,
      difference,
      percentageChange,
      direction: classifyDirection(baselineValue, current.value, direction),
      targetStatus: classifyTargetStatus(baselineValue, current.value, targetValue, direction),
      progressToTarget: progressTowardTarget(baselineValue, current.value, targetValue, direction),
      ...(baseline?.sampleSize !== undefined ? { baselineSampleSize: baseline.sampleSize } : {}),
      ...(current.sampleSize !== undefined ? { currentSampleSize: current.sampleSize } : {}),
      comparisonQuality: classifyComparisonQuality(baseline?.sampleSize, current.sampleSize),
      ...(companyCurrent && companyBaseline
        ? { companyDifference: round(companyCurrent.value - companyBaseline.value, 2) }
        : {}),
    },
  }
}

/* --------------------------------------------------------------- demo actions */

const UNMAPPED_BASELINE_REASON =
  "This action's baseline is the issue's own headline metric, which this prototype does not map to a repeatable survey measure. No target was suggested for it either, so there is nothing to measure against."

function impactForDemoAction(
  action: HrAction,
  dataset: HrDataset,
  analytics: HrAnalytics,
  employeesById: Map<string, Employee>,
): ActionImpact {
  const base = {
    actionId: action.id,
    ...(action.insightId ? { insightId: action.insightId } : {}),
    ...(action.sourceRecommendationId
      ? { sourceRecommendationId: action.sourceRecommendationId }
      : {}),
    actionTitle: action.title,
    issueTitle: action.issueTitle,
    affectedScope: action.affectedScope,
    owner: action.owner,
    startDate: action.startDate,
    dueDate: action.dueDate,
    actionStatus: action.status,
    origin: 'demo-action' as const,
  }

  const metricKey = action.impactMetricKey
  const scope = action.impactScope

  if (!metricKey || !scope) {
    return {
      ...base,
      measurementStatus: 'insufficient-data',
      measurement: null,
      interpretation: UNMAPPED_BASELINE_REASON,
      nextMeasurementLabel: 'Not tracked',
      unmeasurableReason: UNMAPPED_BASELINE_REASON,
      dataSources: [],
    }
  }

  const definition = IMPACT_METRICS[metricKey]

  /* The approved baseline, exactly as recorded — never recalculated. */
  const baseline: Reading | null =
    action.baselineMetric?.value === null || action.baselineMetric?.value === undefined
      ? null
      : { value: action.baselineMetric.value, date: action.startDate }

  const { measurement, reason } = buildMeasurement({
    definition,
    scope,
    startDate: action.startDate,
    baseline,
    targetValue: action.targetMetric?.value ?? null,
    analytics,
    dataset,
    employeesById,
  })

  const measurementStatus = reason
    ? 'insufficient-data'
    : measurement?.currentValue === null || measurement === null
      ? 'awaiting-measurement'
      : 'measurement-available'

  return {
    ...base,
    measurementStatus,
    measurement,
    interpretation: buildInterpretation(
      action.status,
      measurement,
      definition.nextMeasurementLabel,
      reason,
    ),
    nextMeasurementLabel: definition.nextMeasurementLabel,
    ...(reason ? { unmeasurableReason: reason } : {}),
    dataSources: [definition.source],
  }
}

/* ------------------------------------------------------- official actions */

const OFFICIAL_STATUS_MAP = {
  Planned: 'planned',
  'In Progress': 'in-progress',
  Completed: 'completed',
} as const satisfies Record<string, ActionImpact['actionStatus']>

/**
 * A retrospective on an official workbook row: its start date is in the past,
 * so the workbook may already hold readings on both sides of it. Only the rows
 * with a hand-written mapping are measured; the rest state why not.
 */
function impactForOfficialAction(
  record: HrDataset['actions'][number],
  dataset: HrDataset,
  analytics: HrAnalytics,
  employeesById: Map<string, Employee>,
): ActionImpact {
  const base = {
    actionId: record.actionId,
    actionTitle: record.action,
    issueTitle: record.issue,
    affectedScope: record.scope,
    owner: record.owner,
    startDate: record.startDate,
    /* Official rows carry no due date; the start date is all the workbook has. */
    dueDate: record.startDate,
    actionStatus: OFFICIAL_STATUS_MAP[record.status],
    origin: 'official-dataset' as const,
  }

  const mapping = OFFICIAL_ACTION_IMPACT_MAP[record.actionId]
  if (!mapping) {
    const reason =
      OFFICIAL_ACTION_EXCLUSIONS[record.actionId] ??
      'No transparent mapping from this action’s success measure to a metric this workbook records over time.'
    return {
      ...base,
      measurementStatus: 'insufficient-data',
      measurement: null,
      interpretation: reason,
      nextMeasurementLabel: 'Impact measurement not configured',
      unmeasurableReason: reason,
      dataSources: [],
    }
  }

  const definition = IMPACT_METRICS[mapping.metricKey]

  const baseline =
    definition.source === 'Pulse Survey'
      ? pulseAtOrBefore(
          pulseTrendForScope(mapping.scope, analytics),
          definition,
          record.startDate,
        )
      : onboardingAcross(
          onboardingRowsForScope(mapping.scope, dataset, employeesById),
          definition,
          record.startDate,
          'before',
        )

  const targetValue = resolveOfficialTarget(mapping.target, baseline?.value ?? null)

  const { measurement, reason } = buildMeasurement({
    definition,
    scope: mapping.scope,
    startDate: record.startDate,
    baseline,
    targetValue,
    analytics,
    dataset,
    employeesById,
  })

  const measurementStatus = reason
    ? 'insufficient-data'
    : measurement?.currentValue === null || measurement === null
      ? 'awaiting-measurement'
      : 'measurement-available'

  const interpretation = reason
    ? reason
    : `${buildInterpretation(base.actionStatus, measurement, definition.nextMeasurementLabel)} ${mapping.basis}`

  return {
    ...base,
    measurementStatus,
    measurement,
    interpretation,
    nextMeasurementLabel: definition.nextMeasurementLabel,
    ...(reason ? { unmeasurableReason: reason } : {}),
    dataSources: [definition.source, 'Action Tracker'],
  }
}

function resolveOfficialTarget(
  rule: OfficialTargetRule,
  baseline: number | null,
): number | null {
  if (rule.kind === 'absolute') return rule.value
  return baseline === null ? null : round(baseline + rule.delta, 2)
}

/* --------------------------------------------------------------- assembling */

function summarise(impacts: readonly ActionImpact[]): ImpactSummary {
  const countStatus = (status: ActionImpact['measurementStatus']): number =>
    impacts.filter((impact) => impact.measurementStatus === status).length

  const countTarget = (target: string): number =>
    impacts.filter((impact) => impact.measurement?.targetStatus === target).length

  const met = countTarget('met')
  const partiallyMet = countTarget('partially-met')
  const notMet = countTarget('not-met')
  const judged = met + partiallyMet + notMet

  return {
    actionsTracked: impacts.length,
    measurementsAvailable: countStatus('measurement-available'),
    targetsMet: met,
    partiallyMet,
    notMet,
    awaitingMeasurement: countStatus('awaiting-measurement'),
    insufficientData: countStatus('insufficient-data'),
    /*
     * `null`, never 0%, until enough actions have been judged. 0/0 is not a
     * rate, and a rate off one or two actions reads as a verdict on the
     * programme rather than what it is.
     */
    targetAchievementRate:
      judged < IMPACT_RULES.minActionsForRate ? null : round((met / judged) * 100, 0),
  }
}

/** Measured first, then awaiting, then unmeasurable; newest start date first. */
const STATUS_ORDER = {
  'measurement-available': 0,
  'awaiting-measurement': 1,
  'insufficient-data': 2,
} as const

export function calculateActionImpacts(
  actions: readonly HrAction[],
  dataset: HrDataset,
  analytics: HrAnalytics,
): HrImpactResult {
  const employeesById = new Map(dataset.employees.map((employee) => [employee.employeeId, employee]))

  const impacts = [
    ...actions.map((action) => impactForDemoAction(action, dataset, analytics, employeesById)),
    ...dataset.actions.map((record) =>
      impactForOfficialAction(record, dataset, analytics, employeesById),
    ),
  ].sort(
    (a, b) =>
      STATUS_ORDER[a.measurementStatus] - STATUS_ORDER[b.measurementStatus] ||
      b.startDate.localeCompare(a.startDate) ||
      a.actionId.localeCompare(b.actionId),
  )

  return { impacts, summary: summarise(impacts) }
}
