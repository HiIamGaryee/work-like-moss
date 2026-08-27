import {
  DIAGNOSTIC_ACTION_TEMPLATE,
  DIAGNOSTIC_DRIVER_LABEL,
  findActionTemplate,
  scopePhrase,
  suggestOwnerRole,
  type ActionTemplate,
} from '@/data/hr-action-catalog'
import {
  ACTION_DURATION_DAYS,
  ACTION_RECOMMENDATION_MIN_PRIORITY,
  MAX_ACTION_RECOMMENDATIONS,
  suggestTarget,
} from '@/data/hr-action-targets'
import { PRIORITY_LEVEL_LABELS, PRIORITY_LEVEL_ORDER } from '@/data/hr-priority-rules'
import { EVIDENCE_STRENGTH_LABELS, NO_DRIVER_MESSAGE } from '@/data/hr-root-cause-rules'
import type {
  ActionExecutionStatus,
  ActionMetric,
  ActionReviewDraft,
  HrAction,
  RecommendationDriverKey,
  RecommendedAction,
} from '@/types/hr-actions'
import type { ImpactMetricKey } from '@/types/hr-impact'
import type {
  DriverCategory,
  HrInsight,
  InsightDataSource,
  LikelyDriver,
} from '@/types/hr-insights'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import { round } from '@/utils/analytics'
import { isRateMetricLabel } from '@/utils/format'

/**
 * The Action Recommendation Engine.
 *
 *   detected issue  +  top likely driver  +  priority  →  one intervention
 *
 * Nothing here is random and nothing here is invented. A recommendation is a
 * catalogue template selected by the issue's strongest measured driver, an owner
 * role read from a published mapping, a timeline read from the priority level,
 * and a target computed from a baseline that came out of the analytics layer.
 *
 * When no driver clears the evidence bar, the engine recommends validating the
 * issue rather than guessing an intervention. It never executes anything: every
 * output of this file is a suggestion awaiting human approval.
 */

/** Joins sources as "A", "A and B", "A, B and C". */
function joinSources(sources: readonly string[]): string {
  if (sources.length <= 1) return sources[0] ?? 'the available data'
  return `${sources.slice(0, -1).join(', ')} and ${sources[sources.length - 1]}`
}

/**
 * Only these surveys can be run again. An exit-survey score describes people who
 * have already left, so it can never be a baseline for an improvement target —
 * promising to raise it would be a number the data can never confirm.
 */
const RE_MEASURABLE_SOURCES: readonly InsightDataSource[] = ['Pulse Survey', 'Onboarding Survey']

/**
 * Which repeatable measure a driver's evidence represents, resolved from the
 * driver category and the dataset the evidence came from. A two-key lookup, so
 * the Impact Tracker never has to infer a metric from a display string.
 */
const DRIVER_METRIC_KEYS: Partial<
  Record<DriverCategory, Partial<Record<InsightDataSource, ImpactMetricKey>>>
> = {
  'manager-support': {
    'Pulse Survey': 'pulse-manager-support',
    'Onboarding Survey': 'onboarding-manager-support',
  },
  'career-growth': { 'Pulse Survey': 'pulse-career-growth' },
  belonging: { 'Pulse Survey': 'pulse-belonging' },
  workload: { 'Pulse Survey': 'pulse-workload' },
  'role-clarity': { 'Onboarding Survey': 'onboarding-role-clarity' },
  'tools-access': { 'Onboarding Survey': 'onboarding-tools-access' },
  onboarding: { 'Onboarding Survey': 'onboarding-overall' },
}

type ResolvedBaseline = {
  metric: ActionMetric
  /** True when the baseline is a measure this intervention can actually move. */
  isMovable: boolean
  /** Set only when the baseline maps to a repeatable survey measure. */
  metricKey?: ImpactMetricKey
}

/**
 * The baseline is the measure the intervention is meant to move. The top
 * driver's own re-measurable evidence describes the issue most precisely, so it
 * is preferred. Where the driver only has exit evidence, the issue's own headline
 * metric is reported as context instead and no numeric target is suggested —
 * nothing here is fabricated, and a dataset that cannot supply the number yields
 * `null`.
 */
function resolveBaseline(insight: HrInsight, driver: LikelyDriver | null): ResolvedBaseline {
  const movable = driver?.evidence.find(
    (entry) =>
      entry.format === 'score' &&
      typeof entry.value === 'number' &&
      entry.source !== undefined &&
      RE_MEASURABLE_SOURCES.includes(entry.source),
  )

  if (movable && typeof movable.value === 'number' && driver) {
    const metricKey = movable.source
      ? DRIVER_METRIC_KEYS[driver.category]?.[movable.source]
      : undefined
    return {
      metric: { label: movable.label, value: round(movable.value, 2), unit: 'score' },
      isMovable: true,
      ...(metricKey ? { metricKey } : {}),
    }
  }

  const value = insight.currentValue
  return {
    metric: {
      label: insight.metricLabel,
      value: value === null || value === undefined ? null : round(value, 2),
      unit: isRateMetricLabel(insight.metricLabel) ? 'percentage' : 'score',
    },
    isMovable: false,
  }
}

function buildRationale(item: HrIntelligenceItem, driver: LikelyDriver | null): string {
  const { priority } = item
  const priorityPhrase = `The issue is prioritised at ${priority.score} / 100 (${PRIORITY_LEVEL_LABELS[priority.level]}).`

  if (!driver) {
    return `${NO_DRIVER_MESSAGE} The recommended next step therefore validates the issue with the affected group before an intervention is committed. ${priorityPhrase}`
  }

  const strength = EVIDENCE_STRENGTH_LABELS[driver.evidenceStrength].toLowerCase()
  return `${driver.label} is the strongest related signal measured around this issue (${strength}), supported by ${joinSources(driver.dataSources)}. ${priorityPhrase}`
}

function buildRecommendation(item: HrIntelligenceItem): RecommendedAction {
  const { insight, priority } = item
  const driver = item.likelyDrivers[0] ?? null

  const template: ActionTemplate =
    (driver ? findActionTemplate(driver.category, insight.scope.kind) : null) ??
    DIAGNOSTIC_ACTION_TEMPLATE

  const driverKey: RecommendationDriverKey = driver?.category ?? 'diagnostic'
  const { metric: baselineMetric, isMovable, metricKey } = resolveBaseline(insight, driver)

  /**
   * A metric-based promise is only made where a re-measurable baseline exists.
   * Otherwise success is defined by the work being completed, and the target is
   * left empty rather than implying a movement nothing will measure.
   */
  const successMeasureTemplate = isMovable
    ? template.successMeasureTemplate
    : template.operationalSuccessMeasure

  return {
    id: `rec--${insight.id}--${driverKey}`,
    insightId: insight.id,

    title: template.title,
    description: template.description,

    issueTitle: insight.title,
    affectedScope: insight.affectedScope,

    driverCategory: driverKey,
    driverLabel: driver?.label ?? DIAGNOSTIC_DRIVER_LABEL,

    priorityScore: priority.score,
    priorityLevel: priority.level,

    suggestedOwner: suggestOwnerRole(driverKey, insight.scope),
    suggestedDurationDays: template.durationDays ?? ACTION_DURATION_DAYS[priority.level],

    baselineMetric,
    suggestedTarget: isMovable
      ? suggestTarget(baselineMetric, template.targetDirection)
      : { ...baselineMetric, value: null },

    ...(metricKey
      ? { impactMetricKey: metricKey, impactScope: { kind: insight.scope.kind, key: insight.scope.key } }
      : {}),

    successMeasure: successMeasureTemplate.replace('{scope}', scopePhrase(insight.scope)),

    rationale: buildRationale(item, driver),
    evidenceSources: driver ? [...driver.dataSources] : [...insight.dataSources],

    reviewStatus: 'pending-review',
  }
}

/**
 * Overlapping insights can point at the same group, the same driver and the
 * same intervention. Keyed on scope + driver + template, the highest-priority
 * one survives and the duplicates are dropped, so HR is never asked to approve
 * the same conversation twice.
 */
const deduplicationKey = (item: HrIntelligenceItem, recommendation: RecommendedAction): string =>
  [
    item.insight.scope.kind,
    item.insight.scope.key ?? 'company',
    recommendation.driverCategory,
    recommendation.title,
  ].join('::')

export function generateActionRecommendations(
  intelligenceItems: HrIntelligenceItem[],
): RecommendedAction[] {
  const eligible = intelligenceItems
    .filter(
      (item) =>
        !item.insight.isFavourable &&
        item.priority.score >= ACTION_RECOMMENDATION_MIN_PRIORITY,
    )
    .sort(
      (a, b) =>
        PRIORITY_LEVEL_ORDER[a.priority.level] - PRIORITY_LEVEL_ORDER[b.priority.level] ||
        b.priority.score - a.priority.score ||
        a.insight.id.localeCompare(b.insight.id),
    )

  const unique = new Map<string, RecommendedAction>()

  for (const item of eligible) {
    const recommendation = buildRecommendation(item)
    const key = deduplicationKey(item, recommendation)
    if (!unique.has(key)) unique.set(key, recommendation)
  }

  return [...unique.values()].slice(0, MAX_ACTION_RECOMMENDATIONS)
}

/* --------------------------------------- recommendation → approved action */

const parseTargetValue = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** Any change to a suggested value earns the "Edited by HR" badge. */
function isEditedByHr(
  recommendation: RecommendedAction,
  draft: ActionReviewDraft,
): boolean {
  return (
    draft.title.trim() !== recommendation.title ||
    draft.description.trim() !== recommendation.description ||
    draft.owner !== recommendation.suggestedOwner ||
    draft.successMeasure.trim() !== recommendation.successMeasure ||
    parseTargetValue(draft.targetValue) !== recommendation.suggestedTarget.value
  )
}

/**
 * The approval step, as a pure function: an approved recommendation plus the
 * reviewer's edits becomes one tracked record. `id` and `now` are passed in so
 * the conversion stays deterministic and testable; the caller supplies the real
 * browser clock. Approval creates a record and nothing else — nothing is sent,
 * and the source recommendation is left untouched.
 */
export function createActionFromReview(
  recommendation: RecommendedAction,
  draft: ActionReviewDraft,
  id: string,
  now: string,
): HrAction {
  return {
    id,
    sourceRecommendationId: recommendation.id,
    insightId: recommendation.insightId,

    title: draft.title.trim(),
    description: draft.description.trim(),

    issueTitle: recommendation.issueTitle,
    affectedScope: recommendation.affectedScope,

    priorityScoreAtCreation: recommendation.priorityScore,
    priorityLevelAtCreation: recommendation.priorityLevel,

    owner: draft.owner,
    startDate: draft.startDate,
    dueDate: draft.dueDate,

    successMeasure: draft.successMeasure.trim(),

    baselineMetric: recommendation.baselineMetric,
    targetMetric: { ...recommendation.suggestedTarget, value: parseTargetValue(draft.targetValue) },

    /* Carried over verbatim so impact tracking survives a page refresh. */
    ...(recommendation.impactMetricKey ? { impactMetricKey: recommendation.impactMetricKey } : {}),
    ...(recommendation.impactScope ? { impactScope: recommendation.impactScope } : {}),

    status: 'planned',
    editedByHr: isEditedByHr(recommendation, draft),

    createdAt: now,
    updatedAt: now,
  }
}

/**
 * A status change, as a pure function. `completedAt` records that the action was
 * performed — never that it worked; whether it worked is measured against a
 * later survey wave, not claimed here. The first completion timestamp is kept,
 * so re-completing a reopened action does not rewrite history.
 */
export function applyActionStatus(
  action: HrAction,
  status: ActionExecutionStatus,
  now: string,
): HrAction {
  if (action.status === status) return action
  return {
    ...action,
    status,
    updatedAt: now,
    ...(status === 'completed' ? { completedAt: action.completedAt ?? now } : {}),
  }
}
