import type {
  DriverCategory,
  EvidenceStrength,
  InsightCategory,
  InsightScopeKind,
} from '@/types/hr-insights'

/**
 * Developer note — what these rules are, and what they are not
 *
 * These are PROTOTYPE ASSOCIATION RULES. They surface workforce measures that
 * move together with a detected issue so a human can judge them. They do not
 * establish causation: nothing here tests a causal hypothesis, controls for a
 * confounder, or measures a correlation coefficient. A driver is a *related
 * measurable signal*, and every sentence the engine generates says so.
 *
 * They are not validated HR benchmarks or psychological instruments. Every
 * threshold lives here so recalibration is a one-file change.
 *
 * Score thresholds are on the workbook's 1–5 survey scale.
 */
export const ROOT_CAUSE_RULES = {
  /** A group-vs-reference gap this large is worth reporting. */
  meaningfulScoreGap: 0.3,
  /** A score at or below this reads as weak in absolute terms. */
  weakScoreThreshold: 3.3,
  /** A single gap this large can carry a driver on its own. */
  strongGapThreshold: 0.6,
  /** Fewest unfavourable measures needed before a driver is emitted at all. */
  minimumSupportingSignals: 1,
  /** Supporting measures needed for the moderate tier. */
  moderateSupportingSignals: 2,
  /** Supporting measures needed for the strong tier. */
  strongSupportingSignals: 3,
  /** Distinct datasets needed for the strong tier — the cross-source rule. */
  strongSourceCount: 2,
  /** No driver claim below this many employees or responses. */
  minimumGroupSize: 10,
  /** An exit reason at or above this share counts as a supporting measure. */
  relevantExitReasonShare: 12,
} as const

/** At most three drivers per issue, so the page stays reviewable. */
export const MAX_VISIBLE_DRIVERS = 3

/**
 * Which driver categories are worth investigating for each kind of detected
 * issue. Kept explicit and readable rather than hidden inside the service.
 */
export const DRIVER_RELATIONSHIPS: Record<InsightCategory, readonly DriverCategory[]> = {
  engagement: ['manager-support', 'career-growth', 'belonging', 'workload', 'onboarding'],
  onboarding: ['manager-support', 'role-clarity', 'tools-access'],
  retention: ['manager-support', 'career-growth', 'workload', 'employee-experience'],
  'manager-support': ['manager-support', 'role-clarity', 'belonging'],
  'career-growth': ['career-growth', 'manager-support', 'employee-experience'],
  workload: ['workload', 'manager-support'],
  belonging: ['belonging', 'manager-support', 'workload'],
  exit: ['career-growth', 'manager-support', 'workload', 'employee-experience'],
}

/**
 * Role clarity and tools access are onboarding measures. Applying them to a
 * long-tenure or company-wide engagement issue would attribute a new-joiner
 * signal to people it never described, so they are restricted to the scopes
 * where the measure genuinely applies.
 */
export const ONBOARDING_ONLY_DRIVERS: readonly DriverCategory[] = ['role-clarity', 'tools-access']

export const ONBOARDING_DRIVER_SCOPES: readonly InsightScopeKind[] = [
  'new-joiners',
  'tenure-band',
  'company',
  'division',
]

export const DRIVER_LABELS: Record<DriverCategory, string> = {
  'manager-support': 'Manager Support',
  'career-growth': 'Career Growth',
  'role-clarity': 'Role Clarity',
  workload: 'Workload',
  belonging: 'Belonging',
  'tools-access': 'Tools Access',
  onboarding: 'Onboarding Experience',
  'employee-experience': 'Overall Employee Experience',
  retention: 'Retention Pattern',
}

export const EVIDENCE_STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  limited: 'Limited evidence',
}

export const EVIDENCE_STRENGTH_ORDER: Record<EvidenceStrength, number> = {
  strong: 0,
  moderate: 1,
  limited: 2,
}

/**
 * The single place driver evidence strength is decided.
 *
 * The strong tier requires two distinct datasets: this product exists to join
 * fragmented HR sources, so agreement across sources outranks the same number
 * of measures from one survey.
 */
export function classifyEvidenceStrength(
  supportingSignals: number,
  sourceCount: number,
  largestGap: number,
): EvidenceStrength | null {
  const {
    minimumSupportingSignals,
    moderateSupportingSignals,
    strongSupportingSignals,
    strongSourceCount,
    strongGapThreshold,
  } = ROOT_CAUSE_RULES

  if (supportingSignals < minimumSupportingSignals) return null

  if (
    (supportingSignals >= strongSupportingSignals && sourceCount >= strongSourceCount) ||
    (supportingSignals >= moderateSupportingSignals &&
      sourceCount >= strongSourceCount &&
      largestGap >= strongGapThreshold)
  ) {
    return 'strong'
  }

  if (supportingSignals >= moderateSupportingSignals || largestGap >= strongGapThreshold) {
    return 'moderate'
  }

  return 'limited'
}

export const CAUSATION_DISCLAIMER =
  'Likely drivers indicate related workforce signals measured around the same issue. They do not prove causation.'

export const NO_DRIVER_MESSAGE =
  'No strong contributing driver identified from the available structured data.'
