import { isNewJoiner } from '@/data/hr-analytics.constants'
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
  OutcomeStatus,
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
 *  - **Rewrite history.** A stored action baseline always wins. Analytics are
 *    only used to recover a missing baseline or attach its period and sample
 *    context, so an approved numeric baseline cannot drift after the fact.
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
      return tenure !== undefined && isNewJoiner(tenure)
    })
  }
  /* Tenure bands have no onboarding equivalent in this workbook. */
  return []
}

const scopeLabel = (scope: ImpactScope): string =>
  scope.kind === 'company' ? 'company-wide' : (scope.key ?? scope.kind)

/* ------------------------------------------------------------ measurements */

type Reading = {
  value: number
  date: string | null
  period: string | null
  sampleSize?: number
}

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
  return {
    value: round(value, 2),
    date: latest.date,
    period: latest.wave,
    sampleSize: latest.responseCount,
  }
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
  return {
    value: round(value, 2),
    date: last.date,
    period: last.wave,
    sampleSize: last.responseCount,
  }
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
    date: dates[dates.length - 1],
    period: dates.length > 0 ? `Responses through ${dates[dates.length - 1]}` : null,
    sampleSize: matching.length,
  }
}

function comparisonNote(
  definition: ImpactMetricDefinition,
  baseline: Reading | null,
  current: Reading | null,
): string {
  const notes: string[] = []
  if (definition.source === 'Onboarding Survey') {
    notes.push(current
      ? 'This compares later onboarding respondents with an earlier cohort, not the same employees.'
      : 'Any future comparison will use a later onboarding cohort, not repeated responses from the same employees.')
  }

  const baselineSize = baseline?.sampleSize
  const currentSize = current?.sampleSize
  const availableSizes = [baselineSize, currentSize].filter(
    (size): size is number => size !== undefined,
  )
  if (availableSizes.some((size) => size < IMPACT_RULES.minPostActionResponses)) {
    notes.push(`Limited evidence: at least one period has fewer than ${IMPACT_RULES.minPostActionResponses} valid responses.`)
  }
  if (baselineSize !== undefined && currentSize !== undefined) {
    const denominator = Math.max(baselineSize, currentSize)
    if (denominator > 0 &&
        Math.abs(currentSize - baselineSize) / denominator >=
          IMPACT_RULES.notableSampleSizeDifferenceRatio) {
      notes.push('Response counts differ between periods.')
    }
  }
  return notes.join(' ')
}

function outcomeStatusFor(
  measurementStatus: ActionImpact['measurementStatus'],
  measurement: ImpactMeasurement | null,
): OutcomeStatus {
  if (measurementStatus === 'awaiting-measurement') return 'awaiting-measurement'
  if (measurementStatus === 'not-comparable' || !measurement) return 'not-comparable'
  if (measurement.direction === 'improved') return 'improved'
  if (measurement.direction === 'declined') return 'declined'
  if (measurement.direction === 'unchanged') return 'no-clear-change'
  return 'not-comparable'
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
  timingPhrase = 'following action completion',
): string {
  if (unmeasurableReason) return unmeasurableReason

  if (!measurement || measurement.currentValue === null) {
    const state =
      actionStatus === 'completed'
        ? 'The action is complete, but no later comparable measurement is available yet.'
        : 'The action is not complete, so outcome measurement is not ready.'
    return `${state} ${nextMeasurementLabel} would provide the next reading.`
  }

  const { label, baselineValue, currentValue, targetValue, direction, targetStatus } = measurement
  const from = baselineValue === null ? 'its baseline' : baselineValue.toFixed(2)
  if (baselineValue === null || direction === 'unknown') {
    return `A later ${label} reading is available, but no comparable baseline is recorded. No outcome direction is assigned.`
  }

  const movement = `${label} ${DIRECTION_VERBS[direction]} in the next comparable measurement ${timingPhrase}, going from ${from} to ${currentValue.toFixed(2)}`

  if (targetValue === null) {
    return `${movement}. No numeric target was defined, so movement and target attainment remain separate.`
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
  measurementAfterDate: string
  baseline: Reading | null
  targetValue: number | null
  analytics: HrAnalytics
  dataset: HrDataset
  employeesById: Map<string, Employee>
}

function buildMeasurement({
  definition,
  scope,
  measurementAfterDate,
  baseline,
  targetValue,
  analytics,
  dataset,
  employeesById,
}: MeasurementInputs): { measurement: ImpactMeasurement | null; reason?: string } {
  const direction = resolveDirection(definition, analytics)

  const current =
    definition.source === 'Pulse Survey'
      ? latestPulseAfter(pulseTrendForScope(scope, analytics), definition, measurementAfterDate)
      : onboardingAcross(
          onboardingRowsForScope(scope, dataset, employeesById),
          definition,
          measurementAfterDate,
          'after',
        )

  const label = `${definition.label} · ${scopeLabel(scope)}`

  if (!current) {
    return {
      measurement: {
        metricKey: definition.key,
        label,
        source: definition.source,
        scope,
        baselineValue: baseline?.value ?? null,
        currentValue: null,
        targetValue,
        unit: 'score',
        baselineDate: baseline?.date ?? null,
        currentDate: null,
        baselinePeriod: baseline?.period ?? null,
        currentPeriod: null,
        difference: null,
        percentageChange: null,
        direction: 'unknown',
        targetStatus: 'not-measured',
        progressToTarget: null,
        baselineSampleSize: baseline?.sampleSize ?? null,
        currentSampleSize: null,
        comparisonQuality: 'not-comparable',
        note: comparisonNote(definition, baseline, null),
      },
    }
  }

  const baselineValue = baseline?.value ?? null
  const difference =
    baselineValue === null ? null : round(current.value - baselineValue, 2)
  const percentageChange = null

  /* Same metric, same waves, company-wide — context only, never a control. */
  const companyCurrent =
    definition.source === 'Pulse Survey' && scope.kind !== 'company'
      ? latestPulseAfter(analytics.pulse.trend, definition, measurementAfterDate)
      : null
  const companyBaseline =
    companyCurrent !== null && baseline?.date
      ? pulseAtOrBefore(analytics.pulse.trend, definition, baseline.date)
      : null

  const comparisonQuality = baselineValue === null
    ? 'not-comparable' as const
    : classifyComparisonQuality(baseline?.sampleSize, current.sampleSize)

  return {
    measurement: {
      metricKey: definition.key,
      label,
      source: definition.source,
      scope,
      baselineValue,
      currentValue: current.value,
      targetValue,
      unit: 'score',
      baselineDate: baseline?.date ?? null,
      currentDate: current.date,
      baselinePeriod: baseline?.period ?? null,
      currentPeriod: current.period,
      difference,
      percentageChange,
      direction: classifyDirection(baselineValue, current.value, direction),
      targetStatus: classifyTargetStatus(baselineValue, current.value, targetValue, direction),
      progressToTarget: progressTowardTarget(baselineValue, current.value, targetValue, direction),
      baselineSampleSize: baseline?.sampleSize ?? null,
      currentSampleSize: current.sampleSize ?? null,
      comparisonQuality,
      note: comparisonNote(definition, baseline, current),
      ...(companyCurrent && companyBaseline
        ? { companyDifference: round(companyCurrent.value - companyBaseline.value, 2) }
        : {}),
    },
  }
}

/* --------------------------------------------------------------- demo actions */

const UNMAPPED_BASELINE_REASON =
  "This action's baseline is the issue's own headline metric, which this prototype does not map to a repeatable survey measure. No target was suggested for it either, so there is nothing to measure against."

function baselineForAction(
  action: HrAction,
  definition: ImpactMetricDefinition,
  scope: ImpactScope,
  dataset: HrDataset,
  analytics: HrAnalytics,
  employeesById: Map<string, Employee>,
): Reading | null {
  const referenceDate = (action.approvedAt ?? action.createdAt).slice(0, 10)
  const contextual = definition.source === 'Pulse Survey'
    ? pulseAtOrBefore(pulseTrendForScope(scope, analytics), definition, referenceDate)
    : onboardingAcross(
        onboardingRowsForScope(scope, dataset, employeesById),
        definition,
        referenceDate,
        'before',
      )
  const storedValue = action.baselineMetric?.unit === 'score'
    ? action.baselineMetric.value
    : null
  if (storedValue !== null && storedValue !== undefined) {
    return {
      value: storedValue,
      date: contextual?.date ?? null,
      period: contextual?.period ?? null,
      ...(contextual?.sampleSize !== undefined
        ? { sampleSize: contextual.sampleSize }
        : {}),
    }
  }
  return contextual
}

function pendingMeasurement(
  definition: ImpactMetricDefinition,
  scope: ImpactScope,
  baseline: Reading | null,
  targetValue: number | null,
): ImpactMeasurement {
  return {
    metricKey: definition.key,
    label: `${definition.label} · ${scopeLabel(scope)}`,
    source: definition.source,
    scope,
    baselineValue: baseline?.value ?? null,
    currentValue: null,
    targetValue,
    unit: 'score',
    baselineDate: baseline?.date ?? null,
    currentDate: null,
    baselinePeriod: baseline?.period ?? null,
    currentPeriod: null,
    difference: null,
    percentageChange: null,
    direction: 'unknown',
    targetStatus: 'not-measured',
    progressToTarget: null,
    baselineSampleSize: baseline?.sampleSize ?? null,
    currentSampleSize: null,
    comparisonQuality: 'not-comparable',
    note: comparisonNote(definition, baseline, null),
  }
}

function impactForDemoAction(
  action: HrAction,
  dataset: HrDataset,
  analytics: HrAnalytics,
  employeesById: Map<string, Employee>,
): ActionImpact {
  const base = {
    actionId: action.id,
    ...(action.issueId ? { issueId: action.issueId } : {}),
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
    ...(action.completedAt ? { completedAt: action.completedAt } : {}),
    actionStatus: action.status,
    successMetric: action.successMeasure,
    origin: 'demo-action' as const,
  }

  const metricKey = action.impactMetricKey
  const scope = action.impactScope

  if (!metricKey || !scope) {
    return {
      ...base,
      measurementStatus: 'not-comparable',
      outcomeStatus: 'not-comparable',
      measurement: null,
      interpretation: UNMAPPED_BASELINE_REASON,
      nextMeasurementLabel: 'Not tracked',
      unmeasurableReason: UNMAPPED_BASELINE_REASON,
      dataSources: [],
    }
  }

  const definition = IMPACT_METRICS[metricKey]

  /* The stored value wins; analytics only supplies its period and sample context. */
  const baseline = baselineForAction(action, definition, scope, dataset, analytics, employeesById)
  const targetValue = action.targetMetric?.unit === 'score'
    ? action.targetMetric.value
    : null

  if (action.status !== 'completed' || !action.completedAt) {
    const measurement = pendingMeasurement(definition, scope, baseline, targetValue)
    return {
      ...base,
      measurementStatus: 'awaiting-measurement',
      outcomeStatus: 'awaiting-measurement',
      measurement,
      interpretation: buildInterpretation(
        action.status,
        measurement,
        definition.nextMeasurementLabel,
      ),
      nextMeasurementLabel: definition.nextMeasurementLabel,
      dataSources: [definition.source],
    }
  }

  const completedDate = action.completedAt.slice(0, 10)

  const { measurement, reason } = buildMeasurement({
    definition,
    scope,
    measurementAfterDate: completedDate,
    baseline,
    targetValue,
    analytics,
    dataset,
    employeesById,
  })

  const measurementStatus = reason
    ? 'not-comparable'
    : measurement?.currentValue === null || measurement === null
      ? 'awaiting-measurement'
      : measurement.comparisonQuality === 'not-comparable'
        ? 'not-comparable'
        : 'measurement-available'

  return {
    ...base,
    measurementStatus,
    outcomeStatus: outcomeStatusFor(measurementStatus, measurement),
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

const OFFICIAL_STATUS_MAP = new Map<string, ActionImpact['actionStatus']>([
  ['Planned', 'planned'],
  ['In Progress', 'in-progress'],
  ['Completed', 'completed'],
])

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
): ActionImpact | null {
  const actionStatus = OFFICIAL_STATUS_MAP.get(record.status)
  if (!actionStatus) return null
  const base = {
    actionId: record.actionId,
    actionTitle: record.action,
    issueTitle: record.issue,
    affectedScope: record.scope,
    owner: record.owner,
    startDate: record.startDate,
    /* Official rows carry no due date; the start date is all the workbook has. */
    dueDate: record.startDate,
    actionStatus,
    successMetric: record.successMeasure,
    origin: 'official-dataset' as const,
  }

  const mapping = OFFICIAL_ACTION_IMPACT_MAP[record.actionId]
  if (!mapping) {
    const reason =
      OFFICIAL_ACTION_EXCLUSIONS[record.actionId] ??
      'No transparent mapping from this action’s success measure to a metric this workbook records over time.'
    return {
      ...base,
      measurementStatus: 'not-comparable',
      outcomeStatus: 'not-comparable',
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

  if (actionStatus !== 'completed') {
    const measurement = pendingMeasurement(definition, mapping.scope, baseline, targetValue)
    return {
      ...base,
      measurementStatus: 'awaiting-measurement',
      outcomeStatus: 'awaiting-measurement',
      measurement,
      interpretation: buildInterpretation(
        actionStatus,
        measurement,
        definition.nextMeasurementLabel,
      ),
      nextMeasurementLabel: definition.nextMeasurementLabel,
      dataSources: [definition.source, 'Action Tracker'],
    }
  }

  const { measurement, reason } = buildMeasurement({
    definition,
    scope: mapping.scope,
    measurementAfterDate: record.startDate,
    baseline,
    targetValue,
    analytics,
    dataset,
    employeesById,
  })

  const measurementStatus = reason
    ? 'not-comparable'
    : measurement?.currentValue === null || measurement === null
      ? 'awaiting-measurement'
      : measurement.comparisonQuality === 'not-comparable'
        ? 'not-comparable'
        : 'measurement-available'

  const interpretation = reason
    ? reason
    : `${buildInterpretation(base.actionStatus, measurement, definition.nextMeasurementLabel, undefined, 'after its recorded start date')} The official tracker has no completion date, so its recorded start date is the only available timing boundary. ${mapping.basis}`

  return {
    ...base,
    measurementStatus,
    outcomeStatus: outcomeStatusFor(measurementStatus, measurement),
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
    completedActions: impacts.filter((impact) => impact.actionStatus === 'completed').length,
    measurementsAvailable: countStatus('measurement-available'),
    improved: impacts.filter((impact) => impact.outcomeStatus === 'improved').length,
    declined: impacts.filter((impact) => impact.outcomeStatus === 'declined').length,
    noClearChange: impacts.filter((impact) => impact.outcomeStatus === 'no-clear-change').length,
    targetsMet: met,
    partiallyMet,
    notMet,
    awaitingMeasurement: countStatus('awaiting-measurement'),
    notComparable: countStatus('not-comparable'),
    /*
     * `null`, never 0%, until enough actions have been judged. 0/0 is not a
     * rate, and a rate off one or two actions reads as a verdict on the
     * programme rather than what it is.
     */
    targetAchievementRate:
      judged < IMPACT_RULES.minActionsForRate ? null : round((met / judged) * 100, 0),
  }
}

/** Awaiting first, then measured, then non-comparable; newest relevant date first. */
const STATUS_ORDER = {
  'awaiting-measurement': 0,
  'measurement-available': 1,
  'not-comparable': 2,
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
  ].filter((impact) => impact !== null).sort(
    (a, b) =>
      STATUS_ORDER[a.measurementStatus] - STATUS_ORDER[b.measurementStatus] ||
      b.startDate.localeCompare(a.startDate) ||
      a.actionId.localeCompare(b.actionId),
  )

  return { impacts, summary: summarise(impacts) }
}
