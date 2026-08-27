import type { InsightCategory, InsightStrength } from '@/types/hr-insights'

/**
 * Developer note — what these thresholds are, and what they are not
 *
 * These are PROTOTYPE MANAGEMENT RULES for a hackathon demo: round numbers
 * chosen so a reviewer can see the detection logic working and reason about it.
 *
 * They are NOT scientifically validated HR benchmarks, industry standards,
 * psychological assessments, or statistically significant tests. A real
 * deployment would calibrate them against its own historical data and would
 * test whether a difference is significant rather than merely larger than a
 * fixed number. Every threshold lives here so that recalibration is a one-file
 * change and no magic number is scattered through the detection service.
 *
 * Score thresholds are on the workbook's 1–5 survey scale. `baseEngagementGap`
 * is on the 0–1 scale of `Employees.base_engagement`. Shares are percentages.
 */
export const INSIGHT_THRESHOLDS = {
  /** Wave-over-wave engagement movement that counts as material. */
  pulseDecline: 0.25,
  pulseImprovement: 0.25,
  /** Gap between a group's engagement and the company figure. */
  groupEngagementGap: 0.3,
  /** Gap for any other pulse dimension (manager support, workload, belonging…). */
  groupScoreGap: 0.3,
  /** Gap between a group's onboarding score and the company figure. */
  onboardingGap: 0.3,
  /** Gap on the 0–1 base engagement scale. */
  baseEngagementGap: 0.05,
  /** A survey score at or below this reads as weak in absolute terms. */
  weakSurveyScore: 3.5,
  /** A group's leaver rate this many times the company rate is a concentration. */
  leaverRateMultiplier: 1.25,
  /** No group-level claim below this many employees. */
  minimumGroupSize: 10,
  /** No survey-based group claim below this many responses. */
  minimumResponses: 10,
  /** Exit reason share that reads as a substantial concentration. */
  majorExitReasonShare: 25,
  /** Exit reason share worth surfacing as the leading reason. */
  notableExitReasonShare: 15,
  /** A gap this many times the threshold is strong on its own. */
  strongEvidenceMultiplier: 2,
  /** Fraction of a threshold that still earns a "watch" signal. */
  watchRatio: 0.6,
} as const

/** How many signals `/insights` shows; the engine keeps the rest internally. */
export const MAX_VISIBLE_INSIGHTS = 8

/** Two or more supporting measures make a signal strong. */
const STRONG_SIGNAL_COUNT = 2

/**
 * The single place signal strength is decided.
 *
 * `null` means the difference did not clear the watch band, so no insight is
 * created at all. Strength describes how much measurement backs the finding —
 * not how urgent it is.
 */
export function classifySignal(
  gap: number,
  threshold: number,
  supportingSignals = 1,
): InsightStrength | null {
  const magnitude = Math.abs(gap)

  if (
    magnitude >= threshold * INSIGHT_THRESHOLDS.strongEvidenceMultiplier ||
    (magnitude >= threshold && supportingSignals >= STRONG_SIGNAL_COUNT)
  ) {
    return 'strong'
  }
  if (magnitude >= threshold) return 'moderate'
  if (magnitude >= threshold * INSIGHT_THRESHOLDS.watchRatio) return 'watch'
  return null
}

export const STRENGTH_ORDER: Record<InsightStrength, number> = {
  strong: 0,
  moderate: 1,
  watch: 2,
}

export const STRENGTH_LABELS: Record<InsightStrength, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  watch: 'Watch',
}

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  engagement: 'Engagement',
  retention: 'Retention',
  onboarding: 'Onboarding',
  'manager-support': 'Manager Support',
  'career-growth': 'Career Growth',
  workload: 'Workload',
  belonging: 'Belonging',
  exit: 'Exit',
}

/** UI groupings only — several categories can share one tab. */
export const INSIGHT_TABS = [
  { key: 'all', label: 'All', categories: null },
  { key: 'engagement', label: 'Engagement', categories: ['engagement', 'belonging'] },
  { key: 'onboarding', label: 'Onboarding', categories: ['onboarding'] },
  { key: 'retention', label: 'Retention', categories: ['retention'] },
  {
    key: 'workplace',
    label: 'Workplace',
    categories: ['workload', 'manager-support', 'career-growth'],
  },
  { key: 'exit', label: 'Exit', categories: ['exit'] },
] as const satisfies readonly {
  key: string
  label: string
  categories: readonly InsightCategory[] | null
}[]

export type InsightTabKey = (typeof INSIGHT_TABS)[number]['key']

export const DETECTION_RULES_NOTE =
  'Signals come from configurable differences in survey trends, group comparisons, onboarding scores and leaver patterns. Group findings need a minimum sample before they are surfaced.'
