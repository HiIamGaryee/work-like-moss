import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { ActionMetric } from '@/types/hr-actions'
import type { PriorityLevel } from '@/types/hr-intelligence'
import { round } from '@/utils/analytics'

/**
 * Developer note — what these targets are, and what they are not
 *
 * These are PROTOTYPE DEMONSTRATION TARGETS for a hackathon demo: round numbers
 * that show the Action Centre proposing a measurable outcome. They are NOT
 * industry benchmarks, validated HR improvement rates, or committed goals. HR
 * edits every one of them before approving, and the UI always says "suggested".
 *
 * Score values are on the workbook's 1–5 survey scale; rate values are
 * percentage points.
 */
export const ACTION_TARGETS = {
  scoreImprovement: 0.3,
  scoreReduction: 0.3,
  leaverRateReductionPercentagePoints: 5,
} as const

/**
 * Prototype action timelines, in days. A more urgent issue gets a shorter
 * window. These are demo timelines, not official Glocomp policy.
 */
export const ACTION_DURATION_DAYS: Record<PriorityLevel, number> = {
  critical: 30,
  high: 45,
  medium: 60,
  low: 90,
}

/**
 * Only issues at or above this priority score receive a recommendation, so a
 * small monitored signal never turns into action spam. 40 is the `medium`
 * threshold in `hr-priority-rules`, i.e. medium and above.
 */
export const ACTION_RECOMMENDATION_MIN_PRIORITY = 40

/** How many recommendations the Action Centre surfaces at once. */
export const MAX_ACTION_RECOMMENDATIONS = 6

/** Which way a metric has to move for the intervention to have worked. */
export type TargetDirection = 'increase' | 'decrease'

/**
 * Turns a measured baseline into a suggested target, clamped to the metric's
 * real bounds: a 1–5 score can never be suggested above 5 or below 1, and a
 * percentage can never be suggested below 0. A baseline the dataset cannot
 * supply yields a `null` target rather than an invented number.
 */
export function suggestTarget(baseline: ActionMetric, direction: TargetDirection): ActionMetric {
  const { label, unit, value } = baseline

  if (value === null || unit === 'count') return { label, value: null, unit }

  if (unit === 'score') {
    const moved =
      direction === 'increase'
        ? Math.min(SCORE_SCALE.max, value + ACTION_TARGETS.scoreImprovement)
        : Math.max(SCORE_SCALE.min, value - ACTION_TARGETS.scoreReduction)
    return { label, value: round(moved, 2), unit }
  }

  const points = ACTION_TARGETS.leaverRateReductionPercentagePoints
  const moved =
    direction === 'increase' ? Math.min(100, value + points) : Math.max(0, value - points)
  return { label, value: round(moved, 1), unit }
}

export const TARGET_DISCLAIMER =
  'Suggested targets are prototype demonstration values, not industry benchmarks. HR can edit every one of them before approving.'

export const ACTION_RULES_NOTE =
  'Recommendations are generated from the detected issue, its top likely driver and its priority score. Timelines follow the priority level (critical 30 days, high 45, medium 60, low 90) and suggested targets move the measured baseline by a fixed prototype amount. Owners are role suggestions, never named employees.'

export const LOCAL_STORAGE_NOTE = 'Demo action changes are stored locally in this browser.'
