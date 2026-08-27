import type { MetricValue } from '@/utils/analytics'

/**
 * The structured output of the insight engine.
 *
 * Every field is filled from the Step 4 analytics layer. Today the `summary`
 * text is produced by deterministic templates; a future LLM can replace that
 * one string without touching detection, evidence or thresholds.
 */

export type InsightCategory =
  | 'engagement'
  | 'retention'
  | 'onboarding'
  | 'manager-support'
  | 'career-growth'
  | 'workload'
  | 'belonging'
  | 'exit'

export type InsightDirection = 'up' | 'down' | 'flat' | 'higher' | 'lower'

/** Strength of the quantitative evidence — never business priority or urgency. */
export type InsightStrength = 'strong' | 'moderate' | 'watch'

/** The datasets an insight is allowed to cite. */
export type InsightDataSource =
  | 'Employees'
  | 'Onboarding Survey'
  | 'Pulse Survey'
  | 'Exit Survey'
  | 'Action Tracker'

/** How the UI should render a numeric evidence value. Numbers stay raw. */
export type EvidenceFormat =
  | 'score'
  | 'percentage'
  | 'ratio'
  | 'count'
  | 'delta'
  | 'points'
  | 'multiplier'
  | 'text'

/**
 * Where an insight applies, in a form the root-cause engine can resolve back to
 * analytics slices. `key` is the raw workbook value, never a display string.
 */
export type InsightScopeKind =
  | 'company'
  | 'division'
  | 'employee-group'
  | 'tenure-band'
  | 'new-joiners'

export interface InsightScope {
  kind: InsightScopeKind
  key: string | null
  label: string
}

/** Which yardstick normalises a difference into a severity score. */
export type SeverityKind = 'score' | 'rate' | 'share'

/**
 * The distance from a healthy reference, stated in the metric's own units. This
 * is not always `difference`: an absolute-weakness finding measures its shortfall
 * below the weak-score line, not a gap between two groups.
 */
export interface InsightSeverity {
  gap: number
  kind: SeverityKind
}

/* ------------------------------------------------------- likely drivers */

export type DriverCategory =
  | 'manager-support'
  | 'career-growth'
  | 'role-clarity'
  | 'workload'
  | 'belonging'
  | 'tools-access'
  | 'onboarding'
  | 'employee-experience'
  | 'retention'

/** How much measurable evidence backs a driver — not statistical confidence. */
export type EvidenceStrength = 'strong' | 'moderate' | 'limited'

export interface LikelyDriver {
  id: string
  category: DriverCategory
  label: string
  explanation: string
  evidenceStrength: EvidenceStrength
  evidence: InsightEvidence[]
  dataSources: InsightDataSource[]
  /** Largest unfavourable gap behind this driver, for deterministic ranking. */
  largestGap: number
}

export interface InsightEvidence {
  label: string
  value: number | string
  comparison?: number | string
  description: string
  format?: EvidenceFormat
  /** Label for the comparison column, e.g. "company latest wave". */
  comparisonLabel?: string
  /** Which dataset this single measure came from, when it is known. */
  source?: InsightDataSource
}

export interface HrInsight {
  /** Stable, content-derived slug — the same dataset always yields the same id. */
  id: string
  category: InsightCategory
  title: string
  summary: string
  affectedScope: string
  /** Structured form of `affectedScope`, used to resolve driver evidence. */
  scope: InsightScope
  /** True when the measured difference is the desirable direction. */
  isFavourable: boolean
  severity: InsightSeverity
  signalStrength: InsightStrength
  direction?: InsightDirection
  metricLabel: string
  currentValue?: MetricValue
  referenceValue?: MetricValue
  difference?: MetricValue
  evidence: InsightEvidence[]
  dataSources: InsightDataSource[]
  /** The measurable rule that surfaced this signal, shown as "Detected because". */
  detectionRule: string
  /** Employees or survey responses behind the finding, when a count applies. */
  sampleSize?: number
  sampleLabel?: string
  /** Populated by the root-cause service; absent until that step runs. */
  likelyDrivers?: LikelyDriver[]
}

/** Counts derived from the visible insight list, for the page summary. */
export interface InsightSummary {
  totalSignals: number
  strongSignals: number
  moderateSignals: number
  watchSignals: number
  categoryCounts: { category: InsightCategory; count: number }[]
  dataSourceCount: number
  crossSourceSignals: number
}

export interface HrInsightResult {
  insights: HrInsight[]
  /** Every signal the engine detected, before the visible-list limit. */
  allInsights: HrInsight[]
  summary: InsightSummary
  /** Group-level findings held back for failing the minimum sample rule. */
  suppressedForSampleSize: string[]
}
