import type { PriorityLevel } from '@/types/hr-intelligence'

/**
 * Developer note — what these targets are, and what they are not
 *
 * Durations below are prototype timeline hints, never assigned due dates.
 * HR chooses a due date and any numerical target during review.
 */
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

/** Direction metadata retained on the published action templates. */
export type TargetDirection = 'increase' | 'decrease'

export const TARGET_DISCLAIMER =
  'No numeric target is prefilled. HR may define one during review; action completion alone does not establish outcome improvement.'

export const ACTION_RULES_NOTE =
  'Recommendations use group-level priority issues and related evidence to select a published action template. HR must choose the due date and approve the action. Owners are role suggestions, never named employees; new priority suggestions do not invent numeric targets.'

export const LOCAL_STORAGE_NOTE = 'Demo action changes are stored locally in this browser.'
