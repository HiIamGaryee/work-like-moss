import { isInRange } from '@/utils/analytics'

/**
 * Single source of truth for every analytics threshold, scale and label.
 * Nothing in the analytics service or the UI should restate these values.
 */

/** Survey scores in this workbook are 1–5 (see `Data_Dictionary`). */
export const SCORE_SCALE = { min: 1, max: 5 } as const

/** `Employees.base_engagement` is stored as a 0–1 ratio and is kept in that scale. */
export const BASE_ENGAGEMENT_SCALE = { min: 0, max: 1 } as const

/** Tenure is "approximate tenure as of 2026-07-31" in whole months. */
export const TENURE_MONTHS_SCALE = { min: 0, max: 720 } as const

/**
 * Prototype definition of a new joiner. Change it here and every metric,
 * comparison and label follows.
 */
export const NEW_JOINER_MAX_MONTHS = 6

/** Below this count, survey comparisons display a small-sample notice. */
export const MIN_ANALYSIS_SAMPLE_SIZE = 10

/** Descriptive demo cutoffs, not statistical significance thresholds. */
export const MEANINGFUL_SCORE_GAP = 0.2
export const STRONG_SCORE_GAP = 0.3
export const MEANINGFUL_EXIT_SHARE_GAP = 5
export const STRONG_EXIT_SHARE_GAP = 10
export const EVIDENCE_EQUALITY_TOLERANCE = 0.01

/** Point change at or below this magnitude is described as stable. */
export const PULSE_STABLE_THRESHOLD = 0.05

export const TENURE_BANDS = ['0–6 months', '7–12 months', '13–24 months', '25+ months'] as const

export type TenureBand = (typeof TENURE_BANDS)[number]

const TENURE_BAND_UPPER_BOUNDS: readonly { band: TenureBand; maxMonths: number }[] = [
  { band: '0–6 months', maxMonths: NEW_JOINER_MAX_MONTHS },
  { band: '7–12 months', maxMonths: 12 },
  { band: '13–24 months', maxMonths: 24 },
]

export const isValidScore = (value: unknown): value is number =>
  isInRange(value, SCORE_SCALE.min, SCORE_SCALE.max)

export const isValidBaseEngagement = (value: unknown): value is number =>
  isInRange(value, BASE_ENGAGEMENT_SCALE.min, BASE_ENGAGEMENT_SCALE.max)

export const isValidTenure = (value: unknown): value is number =>
  isInRange(value, TENURE_MONTHS_SCALE.min, TENURE_MONTHS_SCALE.max) && Number.isInteger(value)

/**
 * The only place tenure band conditions are written. Returns `null` for a
 * tenure value the workbook cannot support, so the row is excluded rather than
 * silently landing in a band it does not belong to.
 */
export function getTenureBand(tenureMonths: number | null): TenureBand | null {
  if (!isValidTenure(tenureMonths)) return null
  const match = TENURE_BAND_UPPER_BOUNDS.find((entry) => tenureMonths <= entry.maxMonths)
  return match ? match.band : '25+ months'
}

export const isNewJoiner = (tenureMonths: number | null): boolean =>
  isValidTenure(tenureMonths) && tenureMonths <= NEW_JOINER_MAX_MONTHS

/** Decimal places for values read by a person rather than by a formula. */
export const SCORE_PRECISION = 2
export const PERCENTAGE_PRECISION = 2
export const RATIO_PRECISION = 4

/**
 * Tolerance for wave-over-wave comparisons. A difference smaller than this is
 * noise at the precision we display, so the direction reads as `flat`.
 */
export const TREND_TOLERANCE = 0.01

/** How many exit reasons `topExitReasons` exposes — the reasons come from the data. */
export const TOP_EXIT_REASONS_LIMIT = 5

/** The three comparable onboarding dimensions, plus where each average lives. */
export const ONBOARDING_DIMENSIONS = [
  { key: 'managerSupport', label: 'Manager Support', scoreField: 'averageManagerSupport' },
  { key: 'roleClarity', label: 'Role Clarity', scoreField: 'averageRoleClarity' },
  { key: 'toolsAccess', label: 'Tools Access', scoreField: 'averageToolsAccess' },
] as const

export type OnboardingDimensionKey = (typeof ONBOARDING_DIMENSIONS)[number]['key']

/** Display-ready projection of the onboarding averages, overall included. */
export const ONBOARDING_METRICS = [
  { key: 'averageOverallScore', label: 'Overall Onboarding' },
  { key: 'averageManagerSupport', label: 'Manager Support' },
  { key: 'averageRoleClarity', label: 'Role Clarity' },
  { key: 'averageToolsAccess', label: 'Tools Access' },
] as const

export const PULSE_SCORES = [
  { key: 'engagement', label: 'Engagement', field: 'engagementScore' },
  { key: 'managerSupport', label: 'Manager Support', field: 'managerSupport' },
  { key: 'workload', label: 'Workload', field: 'workload' },
  { key: 'careerGrowth', label: 'Career Growth', field: 'careerGrowth' },
  { key: 'belonging', label: 'Belonging', field: 'belonging' },
] as const

export type PulseScoreKey = (typeof PULSE_SCORES)[number]['key']

export const EXIT_METRICS = [
  { key: 'averageOverallExperience', label: 'Overall Experience' },
  { key: 'averageManagerSupport', label: 'Manager Support' },
  { key: 'averageCareerOpportunity', label: 'Career Opportunity' },
  { key: 'averageWorkload', label: 'Workload' },
] as const

/**
 * Where to read the documented meaning of the pulse workload scale.
 *
 * `Data_Dictionary` states: "Perceived workload pressure, 1-5; higher = worse".
 * That direction is parsed from the workbook at runtime rather than hardcoded,
 * and it is exposed as metadata only — the raw score is never reversed.
 */
export const WORKLOAD_DICTIONARY_LOOKUP = { table: 'pulse_survey', field: 'workload' } as const

export const WORKLOAD_DIRECTION_PHRASES = [
  { phrases: ['higher = worse', 'higher is worse'], direction: 'higherIsWorse' },
  { phrases: ['higher = better', 'higher is better'], direction: 'higherIsBetter' },
] as const

export const NEW_JOINER_GROUP_LABEL = `0–${NEW_JOINER_MAX_MONTHS} months tenure`
export const ESTABLISHED_GROUP_LABEL = `Over ${NEW_JOINER_MAX_MONTHS} months tenure`
