import type { ActionExecutionStatus } from '@/types/hr-actions'
import type { InsightDataSource, InsightScopeKind } from '@/types/hr-insights'

/**
 * Impact measurement — the last stage of the decision loop.
 *
 * Three things are deliberately kept apart in this model, because conflating
 * them is the easiest way to mislead a reader:
 *
 *   actionStatus       Was the action carried out?
 *   measurementStatus  Do we have a later reading of the target metric?
 *   direction / target Did that reading move, and did it reach the target?
 *
 * A completed action with no later survey is `awaiting-measurement`, not a
 * success. And a metric that moved after an action is exactly that — moved
 * after. Nothing in this model claims the action caused it.
 */

export type MeasurementStatus =
  | 'awaiting-measurement'
  | 'measurement-available'
  | 'insufficient-data'

export type ImpactDirection = 'improved' | 'declined' | 'unchanged' | 'unknown'

export type TargetStatus = 'met' | 'partially-met' | 'not-met' | 'not-measured'

/**
 * How much weight the comparison can carry. This is a sample-size description,
 * never a statistical confidence — no p-value is computed anywhere.
 */
export type ComparisonQuality = 'comparable' | 'limited' | 'not-comparable'

/** The repeatable survey measures an action can be tracked against. */
export type ImpactMetricKey =
  | 'pulse-engagement'
  | 'pulse-manager-support'
  | 'pulse-career-growth'
  | 'pulse-belonging'
  | 'pulse-workload'
  | 'onboarding-overall'
  | 'onboarding-manager-support'
  | 'onboarding-role-clarity'
  | 'onboarding-tools-access'

/** The workforce slice a baseline was taken from, kept structurally. */
export interface ImpactScope {
  kind: InsightScopeKind
  key: string | null
}

export type ImpactUnit = 'score' | 'percentage' | 'count'

export interface ImpactMeasurement {
  label: string

  baselineValue: number | null
  currentValue: number | null
  targetValue: number | null

  unit: ImpactUnit

  baselineDate?: string | null
  currentDate?: string | null

  /** Raw `current - baseline`, in the metric's own units. */
  difference: number | null
  percentageChange: number | null

  direction: ImpactDirection
  targetStatus: TargetStatus

  /** 0–100 along baseline → target, or `null` when the span is zero. */
  progressToTarget: number | null

  /** Responses behind each side of the comparison, when a count applies. */
  baselineSampleSize?: number
  currentSampleSize?: number
  comparisonQuality: ComparisonQuality

  /** Same metric, same waves, company-wide — context, never a control group. */
  companyDifference?: number | null
}

/** One stage of the traceability chain shown on the decision loop. */
export type LoopStageStatus = 'complete' | 'current' | 'pending'

export interface ActionImpact {
  actionId: string
  insightId?: string
  /** Present for actions approved from a Step 8 recommendation. */
  sourceRecommendationId?: string

  actionTitle: string
  issueTitle: string
  affectedScope: string

  owner: string

  startDate: string
  dueDate: string

  actionStatus: ActionExecutionStatus
  measurementStatus: MeasurementStatus

  measurement: ImpactMeasurement | null

  /** Deterministic prose. Describes what was observed, never what caused it. */
  interpretation: string
  /** Where the next reading would come from, in words. */
  nextMeasurementLabel: string
  /** Why a measurement could not be made, when that is the case. */
  unmeasurableReason?: string

  dataSources: InsightDataSource[]
  /** Official `Action_Tracker` rows are retrospectives, not demo actions. */
  origin: 'demo-action' | 'official-dataset'
}

export interface ImpactSummary {
  actionsTracked: number
  measurementsAvailable: number
  targetsMet: number
  partiallyMet: number
  notMet: number
  awaitingMeasurement: number
  insufficientData: number
  /** `null` until at least one action has a measured target to judge. */
  targetAchievementRate: number | null
}

export interface HrImpactResult {
  impacts: ActionImpact[]
  summary: ImpactSummary
}
