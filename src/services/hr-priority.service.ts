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
import type {
  EvidenceAnalysis,
  EvidenceStrength,
  HrAnalysis,
  HrAnalytics,
  MetricValue,
  PriorityBand,
  PriorityBreakdown as IssuePriorityBreakdown,
  PriorityIssue,
  PrioritySource,
  PulseGroupTrend,
} from '@/types/hr-analytics'
import { MIN_ANALYSIS_SAMPLE_SIZE } from '@/data/hr-analytics.constants'
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
/**
 * Step 4 issue ranking is a transparent demo business rule. It is not a
 * statistical test, prediction, or decision about any employee.
 */
export const SUGGESTED_PRIORITY_CONFIG = {
  weights: { severity: 0.3, reach: 0.2, evidence: 0.3, urgency: 0.2 },
  bands: { high: 70, medium: 40 },
  severity: {
    scoreDeadZone: 0.05,
    scoreFullScale: 0.5,
    leaverDeadZone: 1,
    leaverFullScale: 12,
    onboardingIssueGap: 0.2,
    pulseDeclineIssueGap: 0.15,
  },
  evidence: {
    base: { strong: 75, moderate: 55, limited: 25 },
    sourceBonus: 7,
    sampleBonusMax: 15,
    sampleBonusFullSize: 40,
    smallSampleCap: 35,
    limitedCap: 45,
  },
  urgency: {
    latestWaveSignal: 40,
    declineBase: 50,
    declineFullScale: 0.4,
  },
} as const

type SuggestedPriorityInput = Pick<
  HrAnalysis,
  'workforce' | 'divisions' | 'employeeGroups' | 'pulse' | 'evidence'
>

type IssueDraft = Pick<
  PriorityIssue,
  | 'id'
  | 'title'
  | 'scopeType'
  | 'scopeName'
  | 'metric'
  | 'observedValue'
  | 'benchmarkValue'
  | 'difference'
  | 'sampleSize'
  | 'affectedEmployees'
  | 'reachBasis'
  | 'supportingEvidence'
> & {
  primarySource: PrioritySource
  severity: IssuePriorityBreakdown['severity']
  urgency: IssuePriorityBreakdown['urgency']
  useRelatedEvidence: boolean
  totalEmployees: number
}

function clampIssueScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)))
}

function normaliseIssueGap(gap: number, deadZone: number, fullScale: number): number {
  if (!Number.isFinite(gap) || gap <= deadZone) return 0
  return clampIssueScore(((gap - deadZone) / (fullScale - deadZone)) * 100)
}

function suggestedBand(score: number): PriorityBand {
  if (score >= SUGGESTED_PRIORITY_CONFIG.bands.high) return 'high'
  if (score >= SUGGESTED_PRIORITY_CONFIG.bands.medium) return 'medium'
  return 'low'
}

function issueEvidence(
  source: PrioritySource,
  sampleSize: number,
  related: EvidenceAnalysis | null,
  useRelated: boolean,
): {
  component: IssuePriorityBreakdown['evidence']
  strength: EvidenceStrength
  sources: PrioritySource[]
} {
  const candidate = useRelated
    ? related?.driverCandidates.find((item) => item.strength !== 'limited')
    : undefined
  const supportingSources = candidate?.evidenceItems
    .filter((item) => item.strength === 'moderate' || item.strength === 'strong')
    .map((item) => item.source) ?? []
  const sources = [...new Set<PrioritySource>([source, ...supportingSources])]
  const strength: EvidenceStrength = sampleSize < MIN_ANALYSIS_SAMPLE_SIZE
    ? 'limited'
    : candidate?.strength ?? 'moderate'
  const rules = SUGGESTED_PRIORITY_CONFIG.evidence
  const sampleBonus = Math.min(
    rules.sampleBonusMax,
    (sampleSize / rules.sampleBonusFullSize) * rules.sampleBonusMax,
  )
  let score = clampIssueScore(
    rules.base[strength] + Math.max(0, sources.length - 1) * rules.sourceBonus + sampleBonus,
  )
  if (sampleSize < MIN_ANALYSIS_SAMPLE_SIZE) score = Math.min(score, rules.smallSampleCap)
  if (strength === 'limited') score = Math.min(score, rules.limitedCap)

  const sourceNames = sources.map((item) => item === 'employees' ? 'Employees' : item)
  const reason = sampleSize < MIN_ANALYSIS_SAMPLE_SIZE
    ? `${sourceNames.join(' + ')} has n = ${sampleSize}, below the minimum sample of ${MIN_ANALYSIS_SAMPLE_SIZE}; evidence is capped.`
    : `${sourceNames.join(' + ')} supports this signal with n = ${sampleSize} in the primary source${candidate ? ` and ${candidate.strength} related evidence` : ''}.`

  return { component: { score, reason }, strength, sources }
}

function makeSuggestedIssue(draft: IssueDraft): PriorityIssue | null {
  const severityScore = draft.severity.score
  if (severityScore === null || !Number.isFinite(severityScore) ||
      draft.totalEmployees <= 0 || draft.affectedEmployees < 0) return null

  const reachScore = clampIssueScore(
    (draft.affectedEmployees / draft.totalEmployees) * 100,
  )
  const reach: IssuePriorityBreakdown['reach'] = {
    score: reachScore,
    reason: `${draft.affectedEmployees} of ${draft.totalEmployees} employees are in this scope (${draft.reachBasis}); headcount is a scope proxy, not a count of affected people.`,
  }
  const { component: evidence, strength, sources } = issueEvidence(
    draft.primarySource, draft.sampleSize, draft.supportingEvidence,
    draft.useRelatedEvidence,
  )
  const breakdown: IssuePriorityBreakdown = {
    severity: draft.severity,
    reach,
    evidence,
    urgency: draft.urgency,
  }
  const componentCandidates: Array<{ score: number | null; weight: number }> = [
    { score: breakdown.severity.score, weight: SUGGESTED_PRIORITY_CONFIG.weights.severity },
    { score: breakdown.reach.score, weight: SUGGESTED_PRIORITY_CONFIG.weights.reach },
    { score: breakdown.evidence.score, weight: SUGGESTED_PRIORITY_CONFIG.weights.evidence },
    { score: breakdown.urgency.score, weight: SUGGESTED_PRIORITY_CONFIG.weights.urgency },
  ]
  const components = componentCandidates.filter(
    (item): item is { score: number; weight: number } => item.score !== null,
  )
  if (components.length < 2 || evidence.score === null) return null
  const availableWeight = components.reduce((sum, item) => sum + item.weight, 0)
  if (availableWeight <= 0) return null
  const priorityScore = clampIssueScore(
    components.reduce((sum, item) => sum + item.score * item.weight, 0) / availableWeight,
  )

  return {
    id: draft.id,
    title: draft.title,
    scopeType: draft.scopeType,
    scopeName: draft.scopeName,
    metric: draft.metric,
    observedValue: draft.observedValue,
    benchmarkValue: draft.benchmarkValue,
    difference: draft.difference,
    sampleSize: draft.sampleSize,
    affectedEmployees: draft.affectedEmployees,
    reachBasis: draft.reachBasis,
    severityScore: clampIssueScore(severityScore),
    reachScore,
    evidenceScore: evidence.score,
    urgencyScore: draft.urgency.score,
    priorityScore,
    priorityBand: suggestedBand(priorityScore),
    evidenceStrength: strength,
    sources,
    breakdown,
    supportingEvidence: draft.supportingEvidence,
    explanation: `${draft.severity.reason} ${reach.reason} ${evidence.reason} ${draft.urgency.reason} Suggested priority is a review signal; HR makes the final decision.`,
  }
}

/** One ranked, group-level issue per scope and observed metric. */
export function buildSuggestedPriorityIssues(analysis: SuggestedPriorityInput): PriorityIssue[] {
  const totalEmployees = analysis.workforce.totalEmployees
  if (totalEmployees === 0) return []
  const issues = new Map<string, PriorityIssue>()
  const add = (draft: IssueDraft) => {
    const issue = makeSuggestedIssue(draft)
    if (issue && !issues.has(issue.id)) issues.set(issue.id, issue)
  }
  const divisionEvidence = new Map(
    analysis.evidence.divisions.map((item) => [item.group, item]),
  )
  const employeeGroupEvidence = new Map(
    analysis.evidence.employeeGroups.map((item) => [item.group, item]),
  )
  const groups = [
    ...analysis.divisions.map((item) => ({
      item, scopeType: 'division' as const, scopeName: item.division,
      supportingEvidence: divisionEvidence.get(item.division) ?? null,
      reachBasis: 'division headcount',
    })),
    ...analysis.employeeGroups.map((item) => ({
      item, scopeType: 'employee_group' as const, scopeName: item.group,
      supportingEvidence: employeeGroupEvidence.get(item.group) ?? null,
      reachBasis: 'employee-group headcount',
    })),
  ]

  for (const { item, scopeType, scopeName, supportingEvidence, reachBasis } of groups) {
    const scopeId = `${scopeType}:${encodeURIComponent(scopeName)}`
    const pulseGap = item.engagementDifferenceFromCompany
    if (pulseGap !== null && pulseGap < -SUGGESTED_PRIORITY_CONFIG.severity.scoreDeadZone &&
        item.latestPulseEngagement !== null && analysis.pulse.latestWave) {
      const gap = Math.abs(pulseGap)
      add({
        id: `${scopeId}:pulse_engagement`,
        title: `${scopeName} latest pulse engagement is below the company average`,
        scopeType, scopeName, metric: 'pulse_engagement',
        observedValue: item.latestPulseEngagement,
        benchmarkValue: analysis.pulse.latestWave.averageEngagement,
        difference: pulseGap,
        sampleSize: item.latestPulseResponseCount,
        affectedEmployees: item.employeeCount,
        reachBasis, supportingEvidence, primarySource: 'pulse',
        useRelatedEvidence: true, totalEmployees,
        severity: {
          score: normaliseIssueGap(
            gap,
            SUGGESTED_PRIORITY_CONFIG.severity.scoreDeadZone,
            SUGGESTED_PRIORITY_CONFIG.severity.scoreFullScale,
          ),
          reason: `${scopeName} latest pulse engagement is ${gap.toFixed(2)} points below the same-wave company average (n = ${item.latestPulseResponseCount}).`,
        },
        urgency: {
          score: SUGGESTED_PRIORITY_CONFIG.urgency.latestWaveSignal,
          reason: `The gap appears in the latest recorded pulse wave, ${analysis.pulse.latestWave.wave}; no group trend is inferred.`,
        },
      })
    }

    const leaverGap = item.leaverRate !== null && analysis.workforce.leaverRate !== null
      ? item.leaverRate - analysis.workforce.leaverRate : null
    if (leaverGap !== null && leaverGap > SUGGESTED_PRIORITY_CONFIG.severity.leaverDeadZone) {
      add({
        id: `${scopeId}:leaver_rate`,
        title: `${scopeName} leaver rate is above the company rate`,
        scopeType, scopeName, metric: 'leaver_rate',
        observedValue: item.leaverRate,
        benchmarkValue: analysis.workforce.leaverRate,
        difference: leaverGap,
        sampleSize: item.employeeCount,
        affectedEmployees: item.employeeCount,
        reachBasis, supportingEvidence, primarySource: 'employees',
        useRelatedEvidence: false, totalEmployees,
        severity: {
          score: normaliseIssueGap(
            leaverGap,
            SUGGESTED_PRIORITY_CONFIG.severity.leaverDeadZone,
            SUGGESTED_PRIORITY_CONFIG.severity.leaverFullScale,
          ),
          reason: `${scopeName} leaver rate is ${leaverGap.toFixed(2)} percentage points above the company rate (${item.leaverCount} of ${item.employeeCount} employees).`,
        },
        urgency: {
          score: null,
          reason: 'The workbook has no comparable dated leaver-rate trend; urgency is omitted and the available weights are renormalised.',
        },
      })
    }

    const onboarding = supportingEvidence?.onboarding.find(
      (evidenceItem) => evidenceItem.theme === 'onboardingOverall',
    )
    if (onboarding && onboarding.difference !== null &&
        onboarding.difference < -SUGGESTED_PRIORITY_CONFIG.severity.onboardingIssueGap &&
        onboarding.groupValue !== null) {
      const gap = Math.abs(onboarding.difference)
      add({
        id: `${scopeId}:onboarding_overall`,
        title: `${scopeName} onboarding score is below the company average`,
        scopeType, scopeName, metric: 'onboarding_overall',
        observedValue: onboarding.groupValue,
        benchmarkValue: onboarding.companyValue,
        difference: onboarding.difference,
        sampleSize: onboarding.sampleSize,
        affectedEmployees: item.employeeCount,
        reachBasis, supportingEvidence, primarySource: 'onboarding',
        useRelatedEvidence: true, totalEmployees,
        severity: {
          score: normaliseIssueGap(
            gap,
            SUGGESTED_PRIORITY_CONFIG.severity.scoreDeadZone,
            SUGGESTED_PRIORITY_CONFIG.severity.scoreFullScale,
          ),
          reason: `${scopeName} onboarding is ${gap.toFixed(2)} points below the company onboarding average (n = ${onboarding.sampleSize}).`,
        },
        urgency: {
          score: null,
          reason: 'No comparable onboarding time trend is available; urgency is omitted and the available weights are renormalised.',
        },
      })
    }
  }

  const latest = analysis.pulse.latestWave
  const previous = analysis.pulse.previousWave
  const change = analysis.pulse.latestChange
  if (latest && previous && latest.averageEngagement !== null &&
      previous.averageEngagement !== null &&
      change !== null && change < -SUGGESTED_PRIORITY_CONFIG.severity.pulseDeclineIssueGap) {
    const decline = Math.abs(change)
    add({
      id: 'company:pulse_engagement_decline',
      title: 'Company pulse engagement declined in the latest comparable wave',
      scopeType: 'company', scopeName: 'Company', metric: 'pulse_engagement_change',
      observedValue: latest.averageEngagement,
      benchmarkValue: previous.averageEngagement,
      difference: change,
      sampleSize: latest.responseCount,
      affectedEmployees: analysis.workforce.activeEmployees,
      reachBasis: 'active workforce headcount',
      supportingEvidence: null,
      primarySource: 'pulse', useRelatedEvidence: false, totalEmployees,
      severity: {
        score: normaliseIssueGap(
          decline,
          SUGGESTED_PRIORITY_CONFIG.severity.scoreDeadZone,
          SUGGESTED_PRIORITY_CONFIG.severity.scoreFullScale,
        ),
        reason: `Company pulse engagement fell ${decline.toFixed(2)} points from ${previous.wave} to ${latest.wave} (latest n = ${latest.responseCount}).`,
      },
      urgency: {
        score: clampIssueScore(
          SUGGESTED_PRIORITY_CONFIG.urgency.declineBase +
          normaliseIssueGap(
            decline,
            SUGGESTED_PRIORITY_CONFIG.severity.pulseDeclineIssueGap,
            SUGGESTED_PRIORITY_CONFIG.urgency.declineFullScale,
          ) / 2,
        ),
        reason: `The decline is between the two latest comparable pulse waves, ${previous.wave} and ${latest.wave}.`,
      },
    })
  }

  return [...issues.values()].sort(
    (a, b) => b.priorityScore - a.priorityScore ||
      b.evidenceScore - a.evidenceScore ||
      b.severityScore - a.severityScore ||
      a.id.localeCompare(b.id),
  )
}
