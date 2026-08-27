import type { InsightStrength, SeverityKind } from '@/types/hr-insights'
import type { PriorityBreakdown, PriorityLevel } from '@/types/hr-intelligence'

/**
 * Developer note — what a priority score is, and what it is not
 *
 * Priority scores are PROTOTYPE MANAGEMENT RULES designed to demonstrate issue
 * ranking. They are not validated predictive HR models.
 *
 * A score is a weighted average of five measured components, each normalised to
 * 0–100 and every one of them shown to the user. It is NOT a probability, an AI
 * confidence, a statistical risk, or a prediction of any outcome. It ranks
 * *issues* for management review — never people.
 *
 * A missing component is excluded and the remaining weights are renormalised,
 * so an issue is never penalised or flattered for data the workbook lacks.
 */
export const PRIORITY_WEIGHTS = {
  severity: 0.3,
  trend: 0.2,
  affectedPopulation: 0.2,
  retentionExposure: 0.15,
  evidenceStrength: 0.15,
} as const satisfies Record<keyof PriorityBreakdown, number>

export const PRIORITY_THRESHOLDS = {
  critical: 80,
  high: 60,
  medium: 40,
} as const

/**
 * The difference that reads as maximum severity, in each metric's own units.
 * A one-point gap on the 1–5 survey scale, a 15 percentage-point leaver-rate
 * gap, and a 40% share of exit responses are each treated as fully severe.
 */
export const SEVERITY_FULL_SCALE: Record<SeverityKind, number> = {
  score: 1,
  rate: 15,
  share: 40,
}

/** A 0.5-point wave-over-wave movement is treated as a full-strength trend. */
export const TREND_FULL_SCALE = 0.5

/**
 * Movement smaller than this reads as flat. Wider than the analytics layer's
 * float-noise tolerance on purpose: calling a 0.03-point drift "improving"
 * would overstate what the survey can resolve.
 */
export const TREND_FLAT_BAND = 0.05

/** Neutral trend score for a measured but flat trend. */
export const TREND_NEUTRAL = 50

/** A group leaver rate at this multiple of the company rate is full exposure. */
export const RETENTION_EXPOSURE_FULL_RATIO = 2

/** An exit reason at this share of responses is full exit-overlap exposure. */
export const EXIT_OVERLAP_FULL_SHARE = 30

/** Signal strength converted to a 0–100 component. */
export const EVIDENCE_STRENGTH_SCORES: Record<InsightStrength, number> = {
  strong: 100,
  moderate: 65,
  watch: 35,
}

export const PRIORITY_LEVEL_LABELS: Record<PriorityLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_LEVEL_ORDER: Record<PriorityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const PRIORITY_COMPONENT_LABELS: Record<keyof PriorityBreakdown, string> = {
  severity: 'Severity',
  trend: 'Trend',
  affectedPopulation: 'Affected population',
  retentionExposure: 'Retention exposure',
  evidenceStrength: 'Evidence strength',
}

export const PRIORITY_COMPONENT_DESCRIPTIONS: Record<keyof PriorityBreakdown, string> = {
  severity: 'How far the measure sits from its comparison figure in this dataset.',
  trend: 'Whether the measure is worsening, flat, or improving across pulse waves.',
  affectedPopulation: 'Share of the workforce inside the affected scope.',
  retentionExposure: 'Whether leaver or exit-survey evidence overlaps this issue.',
  evidenceStrength: 'How much measurement backs the detected signal.',
}

export const clampScore = (value: number): number => Math.min(100, Math.max(0, value))

export function toPriorityLevel(score: number): PriorityLevel {
  if (score >= PRIORITY_THRESHOLDS.critical) return 'critical'
  if (score >= PRIORITY_THRESHOLDS.high) return 'high'
  if (score >= PRIORITY_THRESHOLDS.medium) return 'medium'
  return 'low'
}

export const PRIORITY_FORMULA_NOTE =
  'Priority combines five measured components: severity 30%, trend 20%, affected population 20%, retention exposure 15%, evidence strength 15%. A component the dataset cannot support is excluded and the remaining weights are renormalised. Scores rank issues for review; they are prototype management rules, not predictive models.'

export const NO_RETENTION_EVIDENCE_NOTE =
  'No additional retention exposure was identified from the available data.'
