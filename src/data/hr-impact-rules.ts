import type { MetricDirection } from '@/data/hr-metric-rules'
import type {
  ComparisonQuality,
  ImpactDirection,
  ImpactMetricKey,
  ImpactScope,
  TargetStatus,
} from '@/types/hr-impact'
import { round } from '@/utils/analytics'

/**
 * Developer note — what these rules are, and what they are not
 *
 * PROTOTYPE MEASUREMENT RULES for a hackathon demo. They are not validated
 * statistical thresholds, and nothing here tests significance: a change larger
 * than `meaningfulScoreChange` is reported as movement, not as a proven effect.
 * Every threshold lives here so recalibration is a one-file change.
 */
export const IMPACT_RULES = {
  /** Movement smaller than this reads as unchanged, not as improvement. */
  meaningfulScoreChange: 0.1,
  /** Share of the baseline → target span that counts as partially met. */
  targetPartialThreshold: 0.5,
  /** Fewest post-action responses before a comparison is reported at all. */
  minPostActionResponses: 10,
  /** Below this, the comparison is flagged as limited rather than comparable. */
  comparableResponses: 30,
  /**
   * Fewest judged actions before an achievement rate is shown at all. A rate
   * off one or two actions invites a conclusion the sample cannot support.
   */
  minActionsForRate: 3,
} as const

export const IMPACT_RULES_NOTE =
  'Prototype measurement rules. A change larger than 0.1 points is reported as movement; reaching at least half of the baseline-to-target span is reported as partially met. These are demo thresholds, not statistical significance tests.'

export const CAUSATION_NOTE =
  'Observed change after an action does not prove that the action alone caused the change.'

/** Signed movement in the desirable direction, whichever way that runs. */
const favourableChange = (
  baseline: number,
  current: number,
  direction: MetricDirection,
): number => (direction === 'higher-is-better' ? current - baseline : baseline - current)

/**
 * Movement in words. A `lower-is-better` metric that fell has improved, so the
 * raw sign is never read directly.
 */
export function classifyDirection(
  baseline: number | null,
  current: number | null,
  direction: MetricDirection,
): ImpactDirection {
  if (baseline === null || current === null) return 'unknown'

  const change = favourableChange(baseline, current, direction)
  if (Math.abs(change) < IMPACT_RULES.meaningfulScoreChange) return 'unchanged'
  return change > 0 ? 'improved' : 'declined'
}

/**
 * How far along the baseline → target span the current reading sits, as 0–100.
 *
 * Measured against the *span*, not against the target value: `current / target`
 * would report 94% for a metric that had not moved at all. `null` when the span
 * is zero, so a divide-by-zero can never reach the UI.
 */
export function progressTowardTarget(
  baseline: number | null,
  current: number | null,
  target: number | null,
  direction: MetricDirection,
): number | null {
  if (baseline === null || current === null || target === null) return null

  const span = favourableChange(baseline, target, direction)
  if (Math.abs(span) < Number.EPSILON) return null

  const achieved = favourableChange(baseline, current, direction)
  return round(Math.min(100, Math.max(0, (achieved / span) * 100)), 1)
}

export function classifyTargetStatus(
  baseline: number | null,
  current: number | null,
  target: number | null,
  direction: MetricDirection,
): TargetStatus {
  if (baseline === null || current === null || target === null) return 'not-measured'

  const required = favourableChange(baseline, target, direction)
  const achieved = favourableChange(baseline, current, direction)

  /* A target at or behind the baseline is already satisfied by standing still. */
  if (required <= 0) return achieved >= 0 ? 'met' : 'not-met'
  if (achieved >= required) return 'met'
  if (achieved / required >= IMPACT_RULES.targetPartialThreshold) return 'partially-met'
  return 'not-met'
}

/** Sample-size description only — never presented as statistical confidence. */
export function classifyComparisonQuality(
  baselineSample: number | undefined,
  currentSample: number | undefined,
): ComparisonQuality {
  const smallest = Math.min(baselineSample ?? Infinity, currentSample ?? Infinity)
  if (smallest === Infinity) return 'comparable'
  if (smallest < IMPACT_RULES.minPostActionResponses) return 'not-comparable'
  return smallest < IMPACT_RULES.comparableResponses ? 'limited' : 'comparable'
}

/* ------------------------------------------- official Action_Tracker rows */

/**
 * How an official workbook action maps onto a measurable metric.
 *
 * These mappings are written by hand, one row at a time, and only where the
 * action's own success measure names a metric this dataset actually records over
 * time. Nothing is inferred by scanning the free-text measure for keywords: a
 * plausible-looking string match would produce a confident number about the
 * wrong thing, which is worse than reporting nothing.
 *
 * `target` is read from the wording of the action's own success measure:
 *   relative — "increase … by 0.3"      → baseline + delta
 *   absolute — "increase … above 4.0"   → a fixed value
 */
export type OfficialTargetRule =
  | { kind: 'relative'; delta: number }
  | { kind: 'absolute'; value: number }

export interface OfficialActionMapping {
  metricKey: ImpactMetricKey
  scope: ImpactScope
  target: OfficialTargetRule
  /** Quotes the part of the success measure this mapping relies on. */
  basis: string
}

export const OFFICIAL_ACTION_IMPACT_MAP: Record<string, OfficialActionMapping> = {
  A003: {
    metricKey: 'pulse-career-growth',
    scope: { kind: 'company', key: null },
    target: { kind: 'relative', delta: 0.3 },
    basis: 'Success measure: "Increase career-growth score by 0.3". Scope "All" is company-wide.',
  },
  A004: {
    metricKey: 'onboarding-role-clarity',
    scope: { kind: 'division', key: 'Operations' },
    target: { kind: 'absolute', value: 4 },
    basis:
      'Success measure: "Increase onboarding role-clarity score above 4.0". Scope is the Operations division.',
  },
}

/**
 * Official actions this prototype deliberately does not measure, with the
 * reason shown to the reader. Stating why is the point: an unexplained gap
 * looks like an oversight, while a stated limit is a boundary.
 */
export const OFFICIAL_ACTION_EXCLUSIONS: Record<string, string> = {
  A001:
    'The success measure tracks average system-access delay in days. The workbook records no access-delay field, so there is nothing to measure this against.',
  A002:
    'The success measure tracks the share of high-workload pulse responses. The workbook supports a mean workload score, which is a different statistic — reporting it here would measure something the action did not promise.',
  A005:
    'The success measure names two outcomes and sets no numeric target, so no single metric or threshold can be mapped responsibly.',
}
