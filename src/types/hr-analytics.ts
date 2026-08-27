import type {
  OnboardingDimensionKey,
  PulseScoreKey,
  TenureBand,
} from '@/data/hr-analytics.constants'
import type { ActionRecord, ActionStatus, WouldRecommend } from '@/types/hr-data'
import type { MetricValue } from '@/utils/analytics'

export type { MetricValue }

/* ------------------------------------------------------------------ shared */

/** A single labelled number, ready for a UI to map over without relabelling. */
export interface Metric {
  key: string
  label: string
  value: MetricValue
}

/** One bucket of a categorical breakdown. */
export interface GroupMetric {
  group: string
  count: number
  percentage: MetricValue
}

/** One point on any single-series trend line. */
export interface TrendPoint {
  label: string
  date: string | null
  value: MetricValue
  responseCount: number
}

export type ChangeDirection = 'up' | 'down' | 'flat'

export interface ChangeMetric {
  fromLabel: string
  toLabel: string
  from: MetricValue
  to: MetricValue
  absoluteChange: MetricValue
  percentageChange: MetricValue
  direction: ChangeDirection
}

/** Whether a higher score is good, bad, or undocumented in the workbook. */
export type ScoreDirection = 'higherIsBetter' | 'higherIsWorse' | 'unknown'

export interface ScoreInterpretation {
  key: string
  label: string
  direction: ScoreDirection
  source: 'dataDictionary' | 'undocumented'
  description: string | null
}

/* --------------------------------------------------------------- employees */

/** Shared headcount shape reused by every employee breakdown. */
export interface EmployeeCountMetrics {
  employeeCount: number
  activeCount: number
  leaverCount: number
  /** Share of this group marked `Leaver` — not an annualised turnover rate. */
  leaverRate: MetricValue
  averageBaseEngagement: MetricValue
}

export interface DivisionEmployeeMetric extends EmployeeCountMetrics {
  division: string
}

export interface EmployeeGroupMetric extends EmployeeCountMetrics {
  group: string
}

export interface TenureBandEmployeeMetric extends EmployeeCountMetrics {
  band: TenureBand
}

export interface NewJoinerMetrics {
  maxTenureMonths: number
  newJoinerCount: number
  newJoinerActiveCount: number
  newJoinerLeaverCount: number
  newJoinerLeaverRate: MetricValue
  newJoinerAverageBaseEngagement: MetricValue
}

export interface EmployeeAnalytics {
  totalEmployees: number
  activeEmployees: number
  leavers: number
  activeRate: MetricValue
  leaverRate: MetricValue
  /** 0–1 ratio, kept in the source scale. */
  averageBaseEngagement: MetricValue
  byDivision: DivisionEmployeeMetric[]
  byEmployeeGroup: EmployeeGroupMetric[]
  byLocation: EmployeeGroupMetric[]
  byTenureBand: TenureBandEmployeeMetric[]
  newJoiners: NewJoinerMetrics
  /** Factual maximum, not a priority ranking. `null` when no division has a rate. */
  highestLeaverRateDivision: DivisionEmployeeMetric | null
}

/* -------------------------------------------------------------- onboarding */

export interface OnboardingScores {
  averageOverallScore: MetricValue
  averageManagerSupport: MetricValue
  averageRoleClarity: MetricValue
  averageToolsAccess: MetricValue
}

export interface OnboardingGroupMetric extends OnboardingScores {
  group: string
  responseCount: number
}

export interface OnboardingDimensionMetric {
  key: OnboardingDimensionKey
  label: string
  score: MetricValue
}

export interface OnboardingAnalytics extends OnboardingScores {
  responseCount: number
  metrics: Metric[]
  /** The three comparable dimensions, weakest first. */
  dimensions: OnboardingDimensionMetric[]
  weakestDimension: OnboardingDimensionMetric | null
  byDivision: OnboardingGroupMetric[]
  byEmployeeGroup: OnboardingGroupMetric[]
  /** Responses from employees still inside the new joiner tenure window. */
  newJoiners: OnboardingGroupMetric | null
}

/* ------------------------------------------------------------------- pulse */

export interface PulseScores {
  engagement: MetricValue
  managerSupport: MetricValue
  /** Interpretation lives in `PulseAnalytics.workload` — the score is never reversed. */
  workload: MetricValue
  careerGrowth: MetricValue
  belonging: MetricValue
}

export interface PulseTrendPoint extends PulseScores {
  wave: string
  date: string | null
  responseCount: number
}

export interface PulseWave {
  wave: string
  date: string | null
  responseCount: number
}

export interface PulseGroupTrend {
  group: string
  responseCount: number
  averages: PulseScores
  trend: PulseTrendPoint[]
  /** The most recent wave this group answered, or `null` if it answered none. */
  latest: PulseTrendPoint | null
}

export interface PulseSegment {
  group: string
  responseCount: number
  averages: PulseScores
}

export interface PulseComparison {
  newJoiners: PulseSegment
  others: PulseSegment
  /** `newJoiners − others` per score. Sign only, no judgement attached. */
  difference: PulseScores
}

export interface PulseAnalytics {
  responseCount: number
  averages: PulseScores
  metrics: Metric[]
  waves: PulseWave[]
  trend: PulseTrendPoint[]
  engagementChange: ChangeMetric | null
  engagementTrend: TrendPoint[]
  byDivision: PulseGroupTrend[]
  byEmployeeGroup: PulseGroupTrend[]
  byTenureBand: PulseGroupTrend[]
  newJoinerComparison: PulseComparison | null
  workload: ScoreInterpretation
}

/* ------------------------------------------------------------------- exits */

export interface ExitScores {
  averageOverallExperience: MetricValue
  averageManagerSupport: MetricValue
  averageCareerOpportunity: MetricValue
  averageWorkload: MetricValue
}

export interface ExitReasonMetric {
  reason: string
  count: number
  percentage: MetricValue
}

export interface ExitDivisionMetric extends ExitScores {
  division: string
  exitResponseCount: number
  topExitReasons: ExitReasonMetric[]
}

/** Comments are carried through untouched — no sentiment, no keyword scoring. */
export interface ExitCommentRecord {
  employeeId: string
  division: string | null
  primaryExitReason: string
  comment: string
}

export interface ExitCommentAnalytics {
  commentCount: number
  nonEmptyCommentCount: number
  comments: ExitCommentRecord[]
}

export interface ExitAnalytics extends ExitScores {
  responseCount: number
  metrics: Metric[]
  wouldRecommend: GroupMetric[]
  reasons: ExitReasonMetric[]
  topExitReasons: ExitReasonMetric[]
  byDivision: ExitDivisionMetric[]
  comments: ExitCommentAnalytics
}

/* ----------------------------------------------------------------- actions */

export interface ActionScopeMetric {
  scope: string
  count: number
  completed: number
  open: number
}

export interface ActionThemeMetric {
  theme: string
  count: number
  statusBreakdown: GroupMetric[]
}

export interface ActionAnalytics {
  totalActions: number
  plannedActions: number
  inProgressActions: number
  completedActions: number
  /** Everything not yet `Completed`. */
  openActions: number
  completionRate: MetricValue
  byStatus: GroupMetric[]
  byScope: ActionScopeMetric[]
  byTheme: ActionThemeMetric[]
  /** Source records in a deterministic order: not yet completed first, newest start date first. */
  records: ActionRecord[]
}

/* --------------------------------------------------------------- divisions */

/** Per-division roll-up of the breakdowns above, for future cross-cutting views. */
export interface DivisionAnalytics {
  division: string
  employees: DivisionEmployeeMetric
  onboarding: OnboardingGroupMetric | null
  pulse: PulseGroupTrend | null
  exits: ExitDivisionMetric | null
}

/* ---------------------------------------------------------------- overview */

export interface OverviewOnboarding {
  responseCount: number
  averageScore: MetricValue
  managerSupport: MetricValue
  roleClarity: MetricValue
  toolsAccess: MetricValue
}

export interface OverviewLatestPulse extends PulseScores {
  wave: string | null
  date: string | null
  responseCount: number
}

export interface OverviewAnalytics {
  totalEmployees: number
  activeEmployees: number
  leavers: number
  leaverRate: MetricValue
  averageBaseEngagement: MetricValue
  newJoinerCount: number
  newJoinerLeaverRate: MetricValue
  onboarding: OverviewOnboarding
  latestPulse: OverviewLatestPulse
  exitResponseCount: number
  totalActions: number
  openActions: number
}

/* ----------------------------------------------------------- data quality */

export interface DataQualityReport {
  valid: boolean
  warnings: string[]
  errors: string[]
}

/* -------------------------------------------------------------------- root */

export interface AnalyticsRowCounts {
  employees: number
  onboardingSurveys: number
  pulseSurveys: number
  exitSurveys: number
  actions: number
}

export interface AnalyticsMeta {
  scoreScale: { min: number; max: number }
  baseEngagementScale: { min: number; max: number }
  newJoinerMaxTenureMonths: number
  tenureBands: readonly TenureBand[]
  rowCounts: AnalyticsRowCounts
}

export interface HrAnalytics {
  overview: OverviewAnalytics
  employees: EmployeeAnalytics
  onboarding: OnboardingAnalytics
  pulse: PulseAnalytics
  exits: ExitAnalytics
  actions: ActionAnalytics
  divisions: DivisionAnalytics[]
  dataQuality: DataQualityReport
  meta: AnalyticsMeta
}

export type { ActionStatus, OnboardingDimensionKey, PulseScoreKey, TenureBand, WouldRecommend }
