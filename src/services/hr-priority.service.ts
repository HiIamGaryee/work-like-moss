import {
  EVIDENCE_STRENGTH_SCORES,
  EXIT_OVERLAP_FULL_SHARE,
  NO_RETENTION_EVIDENCE_NOTE,
  PRIORITY_COMPONENT_DESCRIPTIONS,
  PRIORITY_COMPONENT_LABELS,
  PRIORITY_LEVEL_LABELS,
  PRIORITY_WEIGHTS,
  RETENTION_EXPOSURE_FULL_RATIO,
  SEVERITY_FULL_SCALE,
  TREND_FULL_SCALE,
  TREND_NEUTRAL,
  TREND_FLAT_BAND,
  clampScore,
  toPriorityLevel,
} from '@/data/hr-priority-rules'
import { ROOT_CAUSE_RULES } from '@/data/hr-root-cause-rules'
import type { HrAnalytics, MetricValue, PulseGroupTrend } from '@/types/hr-analytics'
import type { HrInsight, InsightScope, LikelyDriver } from '@/types/hr-insights'
import type {
  InsightPriority,
  PriorityBreakdown,
  PriorityComponentDetail,
} from '@/types/hr-intelligence'
import { round } from '@/utils/analytics'

/**
 * Issue-level priority.
 *
 * Five measured components, each 0–100, combined with fixed published weights.
 * A component the dataset cannot support is `null`: it is excluded and the
 * remaining weights are renormalised, rather than being silently scored as zero.
 *
 * The score ranks issues for management review. It is not a probability, a
 * prediction, or a statement about any individual.
 */

/* -------------------------------------------------------------- components */

/** Distance from the comparison figure, normalised by the metric's own scale. */
function severityComponent(insight: HrInsight): number {
  // An improving or better-than-reference finding is not a severe issue.
  if (insight.isFavourable) return 0
  const scale = SEVERITY_FULL_SCALE[insight.severity.kind]
  return clampScore((insight.severity.gap / scale) * 100)
}

const trendOf = (group: PulseGroupTrend | null): number | null => {
  if (!group) return null
  const first = group.trend.find((point) => point.responseCount > 0) ?? null
  const latest = [...group.trend].reverse().find((point) => point.responseCount > 0) ?? null
  if (!first || !latest || first.wave === latest.wave) return null
  if (first.engagement === null || latest.engagement === null) return null
  return round(latest.engagement - first.engagement, 4)
}

/** Finds the pulse trend that describes this scope, if the dataset has one. */
function scopeTrend(scope: InsightScope, analytics: HrAnalytics): number | null {
  switch (scope.kind) {
    case 'company':
      return analytics.pulse.engagementChange?.absoluteChange ?? null
    case 'division':
      return trendOf(analytics.pulse.byDivision.find((g) => g.group === scope.key) ?? null)
    case 'employee-group':
      return trendOf(analytics.pulse.byEmployeeGroup.find((g) => g.group === scope.key) ?? null)
    case 'tenure-band':
      return trendOf(analytics.pulse.byTenureBand.find((g) => g.group === scope.key) ?? null)
    case 'new-joiners':
      return trendOf(
        analytics.pulse.byTenureBand.find((g) => g.group.startsWith('0–')) ?? null,
      )
  }
}

/**
 * Worsening raises the score, improving lowers it, flat sits neutral. A trend
 * the dataset cannot measure is `null` and gets reweighted out — positive
 * trends are never punished.
 */
function trendComponent(insight: HrInsight, analytics: HrAnalytics): number | null {
  const change = scopeTrend(insight.scope, analytics)
  if (change === null) return null
  if (Math.abs(change) < TREND_FLAT_BAND) return TREND_NEUTRAL

  const magnitude = (Math.abs(change) / TREND_FULL_SCALE) * TREND_NEUTRAL
  const worsening = change < 0
  return clampScore(worsening ? TREND_NEUTRAL + magnitude : TREND_NEUTRAL - magnitude)
}

/** Employees in scope as a share of the workforce. */
function populationComponent(insight: HrInsight, analytics: HrAnalytics): number | null {
  const total = analytics.employees.totalEmployees
  if (total === 0) return null

  const inScope = employeesInScope(insight.scope, analytics)
  if (inScope === null) return null
  return clampScore((inScope / total) * 100)
}

function employeesInScope(scope: InsightScope, analytics: HrAnalytics): number | null {
  switch (scope.kind) {
    case 'company':
      return analytics.employees.totalEmployees
    case 'division':
      return (
        analytics.employees.byDivision.find((e) => e.division === scope.key)?.employeeCount ?? null
      )
    case 'employee-group':
      return (
        analytics.employees.byEmployeeGroup.find((e) => e.group === scope.key)?.employeeCount ??
        null
      )
    case 'tenure-band':
      return analytics.employees.byTenureBand.find((e) => e.band === scope.key)?.employeeCount ?? null
    case 'new-joiners':
      return analytics.employees.newJoiners.newJoinerCount
  }
}

const ratioOf = (value: MetricValue, reference: MetricValue): number | null =>
  value === null || reference === null || reference === 0 ? null : value / reference

/**
 * Retention exposure comes from real retention evidence only: the scope's own
 * leaver rate against the dataset rate, and any exit reason that overlaps the
 * issue's driver categories. With neither available the component is `null`,
 * and the explanation says so rather than inventing a link.
 */
function retentionComponent(
  insight: HrInsight,
  analytics: HrAnalytics,
  drivers: readonly LikelyDriver[],
): number | null {
  const parts: number[] = []

  const leaverRate = leaverRateInScope(insight.scope, analytics)
  const ratio = ratioOf(leaverRate, analytics.employees.leaverRate)
  if (ratio !== null && ratio > 1) {
    parts.push(clampScore(((ratio - 1) / (RETENTION_EXPOSURE_FULL_RATIO - 1)) * 100))
  } else if (ratio !== null) {
    parts.push(0)
  }

  const overlap = exitOverlapShare(insight, drivers, analytics)
  if (overlap !== null) {
    parts.push(clampScore((overlap / EXIT_OVERLAP_FULL_SHARE) * 100))
  }

  if (parts.length === 0) return null
  return Math.max(...parts)
}

function leaverRateInScope(scope: InsightScope, analytics: HrAnalytics): MetricValue {
  switch (scope.kind) {
    case 'company':
      return analytics.employees.leaverRate
    case 'division':
      return analytics.employees.byDivision.find((e) => e.division === scope.key)?.leaverRate ?? null
    case 'employee-group':
      return analytics.employees.byEmployeeGroup.find((e) => e.group === scope.key)?.leaverRate ?? null
    case 'tenure-band':
      return analytics.employees.byTenureBand.find((e) => e.band === scope.key)?.leaverRate ?? null
    case 'new-joiners':
      return analytics.employees.newJoiners.newJoinerLeaverRate
  }
}

/** Maps driver themes onto the exit reason wording the workbook actually uses. */
const EXIT_REASON_KEYWORDS: Record<string, string> = {
  'manager-support': 'manager',
  'career-growth': 'career',
  workload: 'workload',
  belonging: 'culture',
  'role-clarity': 'role',
  'employee-experience': 'culture',
}

function exitOverlapShare(
  insight: HrInsight,
  drivers: readonly LikelyDriver[],
  analytics: HrAnalytics,
): number | null {
  const themes = new Set<string>([insight.category, ...drivers.map((driver) => driver.category)])
  const keywords = [...themes]
    .map((theme) => EXIT_REASON_KEYWORDS[theme])
    .filter((keyword): keyword is string => keyword !== undefined)

  if (keywords.length === 0) return null

  const shares = analytics.exits.reasons
    .filter((reason) => keywords.some((keyword) => reason.reason.toLowerCase().includes(keyword)))
    .map((reason) => reason.percentage)
    .filter((share): share is number => share !== null)
    .filter((share) => share >= ROOT_CAUSE_RULES.relevantExitReasonShare)

  return shares.length === 0 ? null : Math.max(...shares)
}

/* -------------------------------------------------------------- assembling */

const COMPONENT_ORDER: (keyof PriorityBreakdown)[] = [
  'severity',
  'trend',
  'affectedPopulation',
  'retentionExposure',
  'evidenceStrength',
]

/** Thresholds above which a component earns a line in the explanation. */
const NOTABLE = 60

function buildReasons(
  insight: HrInsight,
  breakdown: PriorityBreakdown,
  drivers: readonly LikelyDriver[],
): string[] {
  const reasons: string[] = []

  const metric = insight.metricLabel.toLowerCase()
  if (insight.isFavourable) {
    reasons.push('the measured difference is in the favourable direction')
  } else if ((breakdown.severity ?? 0) >= NOTABLE) {
    reasons.push(`${metric} differs materially from its comparison figure`)
  } else {
    reasons.push(`${metric} differs measurably from its comparison figure`)
  }

  if (breakdown.trend !== null) {
    if (breakdown.trend > TREND_NEUTRAL) reasons.push('the trend is worsening across pulse waves')
    else if (breakdown.trend < TREND_NEUTRAL) reasons.push('the trend is improving across pulse waves')
    else reasons.push('the trend is flat across pulse waves')
  }

  if ((breakdown.affectedPopulation ?? 0) >= NOTABLE) {
    reasons.push('the issue covers a large share of the workforce')
  } else if (breakdown.affectedPopulation !== null && breakdown.affectedPopulation < 20) {
    reasons.push('the affected group is a small share of the workforce')
  }

  if (breakdown.retentionExposure === null) {
    reasons.push(NO_RETENTION_EVIDENCE_NOTE.replace(/^No/, 'no').replace(/\.$/, ''))
  } else if (breakdown.retentionExposure >= NOTABLE) {
    reasons.push('leaver or exit-survey evidence overlaps this issue')
  }

  if (drivers.length > 0) {
    const strong = drivers.filter((driver) => driver.evidenceStrength === 'strong').length
    reasons.push(
      strong > 0
        ? `${strong} likely ${strong === 1 ? 'driver has' : 'drivers have'} strong supporting evidence`
        : `${drivers.length} related ${drivers.length === 1 ? 'signal was' : 'signals were'} identified`,
    )
  }

  return reasons
}

export function calculateInsightPriority(
  insight: HrInsight,
  analytics: HrAnalytics,
  drivers: readonly LikelyDriver[],
): InsightPriority {
  const breakdown: PriorityBreakdown = {
    severity: severityComponent(insight),
    trend: trendComponent(insight, analytics),
    affectedPopulation: populationComponent(insight, analytics),
    retentionExposure: retentionComponent(insight, analytics, drivers),
    evidenceStrength: EVIDENCE_STRENGTH_SCORES[insight.signalStrength],
  }

  // Renormalise over the components the dataset could actually supply.
  const available = COMPONENT_ORDER.filter((key) => breakdown[key] !== null)
  const totalWeight = available.reduce((sum, key) => sum + PRIORITY_WEIGHTS[key], 0)

  const score =
    totalWeight === 0
      ? 0
      : Math.round(
          available.reduce(
            (sum, key) => sum + (breakdown[key] ?? 0) * (PRIORITY_WEIGHTS[key] / totalWeight),
            0,
          ),
        )

  const level = toPriorityLevel(score)

  const components: PriorityComponentDetail[] = COMPONENT_ORDER.map((key) => ({
    key,
    label: PRIORITY_COMPONENT_LABELS[key],
    value: breakdown[key] === null ? null : Math.round(breakdown[key] ?? 0),
    appliedWeight:
      breakdown[key] === null || totalWeight === 0
        ? 0
        : round(PRIORITY_WEIGHTS[key] / totalWeight, 4),
    description: PRIORITY_COMPONENT_DESCRIPTIONS[key],
  }))

  const reasons = buildReasons(insight, breakdown, drivers)

  return {
    score,
    level,
    breakdown,
    components,
    reasons,
    explanation: `${PRIORITY_LEVEL_LABELS[level]} priority because ${reasons.join(', ')}.`,
  }
}
