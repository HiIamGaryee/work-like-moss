import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import {
  DRIVER_LABELS,
  DRIVER_RELATIONSHIPS,
  MAX_VISIBLE_DRIVERS,
  ONBOARDING_DRIVER_SCOPES,
  ONBOARDING_ONLY_DRIVERS,
  ROOT_CAUSE_RULES,
  EVIDENCE_STRENGTH_ORDER,
  classifyEvidenceStrength,
} from '@/data/hr-root-cause-rules'
import type {
  DivisionEmployeeMetric,
  EmployeeCountMetrics,
  ExitDivisionMetric,
  HrAnalytics,
  MetricValue,
  OnboardingGroupMetric,
  PulseScoreKey,
  PulseTrendPoint,
} from '@/types/hr-analytics'
import type {
  DriverCategory,
  HrInsight,
  InsightDataSource,
  InsightEvidence,
  InsightScope,
  LikelyDriver,
} from '@/types/hr-insights'
import { round } from '@/utils/analytics'

/**
 * Likely-driver analysis.
 *
 * Given a detected signal, this looks across the other datasets for measures
 * that sit unfavourably around the same group, and reports them as *related*
 * signals. It never asserts that one measure caused another: there is no causal
 * test here, and the generated sentences say "is also weaker", not "is why".
 *
 * Every driver must carry at least one measurable, unfavourable value. A driver
 * with no evidence is not emitted — the UI shows an explicit "no strong
 * contributing driver" message instead of an invented one.
 */

const {
  meaningfulScoreGap,
  weakScoreThreshold,
  minimumGroupSize,
  relevantExitReasonShare,
} = ROOT_CAUSE_RULES

/* ------------------------------------------------------------ scope resolve */

type ResolvedScope = {
  scope: InsightScope
  employees: EmployeeCountMetrics | null
  pulseLatest: PulseTrendPoint | null
  pulseFirst: PulseTrendPoint | null
  pulseResponses: number
  onboarding: OnboardingGroupMetric | null
  exit: ExitDivisionMetric | null
  /** True when the scope *is* the company, so there is nothing to compare against. */
  isCompany: boolean
}

const latestOf = (trend: readonly PulseTrendPoint[] | undefined): PulseTrendPoint | null =>
  trend ? ([...trend].reverse().find((point) => point.responseCount > 0) ?? null) : null

const firstOf = (trend: readonly PulseTrendPoint[] | undefined): PulseTrendPoint | null =>
  trend ? (trend.find((point) => point.responseCount > 0) ?? null) : null

/**
 * Maps a structured scope onto the analytics slices that describe it. Nothing
 * here parses a display string.
 */
function resolveScope(scope: InsightScope, analytics: HrAnalytics): ResolvedScope {
  const empty: ResolvedScope = {
    scope,
    employees: null,
    pulseLatest: null,
    pulseFirst: null,
    pulseResponses: 0,
    onboarding: null,
    exit: null,
    isCompany: false,
  }

  if (scope.kind === 'company') {
    return {
      ...empty,
      isCompany: true,
      employees: {
        employeeCount: analytics.employees.totalEmployees,
        activeCount: analytics.employees.activeEmployees,
        leaverCount: analytics.employees.leavers,
        leaverRate: analytics.employees.leaverRate,
        averageBaseEngagement: analytics.employees.averageBaseEngagement,
      },
      pulseLatest: latestOf(analytics.pulse.trend),
      pulseFirst: firstOf(analytics.pulse.trend),
      pulseResponses: analytics.pulse.responseCount,
      onboarding: {
        group: 'Company-wide',
        responseCount: analytics.onboarding.responseCount,
        averageOverallScore: analytics.onboarding.averageOverallScore,
        averageManagerSupport: analytics.onboarding.averageManagerSupport,
        averageRoleClarity: analytics.onboarding.averageRoleClarity,
        averageToolsAccess: analytics.onboarding.averageToolsAccess,
      },
    }
  }

  if (scope.kind === 'new-joiners') {
    const comparison = analytics.pulse.newJoinerComparison
    const band = analytics.pulse.byTenureBand.find((entry) => entry.group.startsWith('0–')) ?? null
    const joiners = analytics.employees.newJoiners
    return {
      ...empty,
      employees: {
        employeeCount: joiners.newJoinerCount,
        activeCount: joiners.newJoinerActiveCount,
        leaverCount: joiners.newJoinerLeaverCount,
        leaverRate: joiners.newJoinerLeaverRate,
        averageBaseEngagement: joiners.newJoinerAverageBaseEngagement,
      },
      pulseLatest: band?.latest ?? null,
      pulseFirst: firstOf(band?.trend),
      pulseResponses: comparison?.newJoiners.responseCount ?? band?.responseCount ?? 0,
      onboarding: analytics.onboarding.newJoiners,
    }
  }

  const key = scope.key
  if (key === null) return empty

  if (scope.kind === 'division') {
    const division: DivisionEmployeeMetric | undefined = analytics.employees.byDivision.find(
      (entry) => entry.division === key,
    )
    const pulse = analytics.pulse.byDivision.find((entry) => entry.group === key)
    return {
      ...empty,
      employees: division ?? null,
      pulseLatest: pulse?.latest ?? null,
      pulseFirst: firstOf(pulse?.trend),
      pulseResponses: pulse?.responseCount ?? 0,
      onboarding: analytics.onboarding.byDivision.find((entry) => entry.group === key) ?? null,
      exit: analytics.exits.byDivision.find((entry) => entry.division === key) ?? null,
    }
  }

  if (scope.kind === 'employee-group') {
    const pulse = analytics.pulse.byEmployeeGroup.find((entry) => entry.group === key)
    return {
      ...empty,
      employees: analytics.employees.byEmployeeGroup.find((entry) => entry.group === key) ?? null,
      pulseLatest: pulse?.latest ?? null,
      pulseFirst: firstOf(pulse?.trend),
      pulseResponses: pulse?.responseCount ?? 0,
      onboarding:
        analytics.onboarding.byEmployeeGroup.find((entry) => entry.group === key) ?? null,
    }
  }

  const pulse = analytics.pulse.byTenureBand.find((entry) => entry.group === key)
  return {
    ...empty,
    employees: analytics.employees.byTenureBand.find((entry) => entry.band === key) ?? null,
    pulseLatest: pulse?.latest ?? null,
    pulseFirst: firstOf(pulse?.trend),
    pulseResponses: pulse?.responseCount ?? 0,
  }
}

/* ------------------------------------------------------------------- probes */

type Probe = {
  label: string
  source: InsightDataSource
  value: number
  reference: number | null
  referenceLabel: string | null
  gap: number | null
  supporting: boolean
  description: string
  /**
   * Why this probe counts as support. `gap` means it sits unfavourably against
   * its comparison; `absolute` means the value itself is at or below the weak
   * line even though the gap is not unfavourable. The two must be described
   * differently, or a better-than-average value reads as a problem.
   */
  supportReason: 'gap' | 'absolute' | null
  /** True for company-wide fallbacks, which yield to a group-specific probe. */
  isFallback: boolean
}

type ProbeSpec = {
  label: string
  source: InsightDataSource
  /** Direction that counts as good. Absolute weakness only applies when true. */
  higherIsBetter: boolean
  description: string
  read: (resolved: ResolvedScope, analytics: HrAnalytics) => MetricValue
  /** Omit for a probe that has no group comparison, only an absolute reading. */
  reference?: (analytics: HrAnalytics) => MetricValue
  referenceLabel?: string
  /** Minimum responses in the scope before this probe is trusted. */
  sampleOf?: (resolved: ResolvedScope) => number
  isFallback?: boolean
}

function runProbe(spec: ProbeSpec, resolved: ResolvedScope, analytics: HrAnalytics): Probe | null {
  const value = spec.read(resolved, analytics)
  if (value === null) return null

  const sample = spec.sampleOf?.(resolved)
  if (sample !== undefined && sample < minimumGroupSize) return null

  const reference =
    resolved.isCompany || !spec.reference ? null : (spec.reference(analytics) ?? null)
  const gap = reference === null ? null : round(value - reference, 4)

  const unfavourableGap =
    gap !== null &&
    Math.abs(gap) >= meaningfulScoreGap &&
    (spec.higherIsBetter ? gap < 0 : gap > 0)

  /**
   * Absolute weakness is only meaningful when a higher score is the better
   * outcome. Applying "at or below the weak line" to workload — where the
   * workbook says higher is worse — would read a healthy score as a problem.
   */
  const absolutelyWeak = spec.higherIsBetter && value <= weakScoreThreshold

  return {
    label: spec.label,
    source: spec.source,
    value,
    reference,
    referenceLabel: reference === null ? null : (spec.referenceLabel ?? null),
    gap,
    supporting: unfavourableGap || absolutelyWeak,
    supportReason: unfavourableGap ? 'gap' : absolutelyWeak ? 'absolute' : null,
    description: spec.description,
    isFallback: spec.isFallback === true,
  }
}

/**
 * Drops a company-wide fallback once a group-specific probe from the same
 * dataset survived, so one measure is never counted twice.
 */
function preferSpecificProbes(probes: readonly Probe[]): Probe[] {
  const specificSources = new Set(
    probes.filter((probe) => !probe.isFallback).map((probe) => probe.source),
  )
  return probes.filter((probe) => !probe.isFallback || !specificSources.has(probe.source))
}

const pulseProbe = (key: PulseScoreKey, label: string, higherIsBetter: boolean): ProbeSpec => ({
  label: `Pulse ${label}`,
  source: 'Pulse Survey',
  higherIsBetter,
  description: 'Latest pulse wave score for the affected group.',
  read: (resolved) => resolved.pulseLatest?.[key] ?? null,
  reference: (analytics) => analytics.overview.latestPulse[key],
  referenceLabel: 'company latest wave',
  sampleOf: (resolved) => resolved.pulseLatest?.responseCount ?? 0,
})

const onboardingProbe = (
  key: keyof OnboardingGroupMetric & `average${string}`,
  label: string,
  referenceRead: (analytics: HrAnalytics) => MetricValue,
): ProbeSpec => ({
  label: `Onboarding ${label}`,
  source: 'Onboarding Survey',
  higherIsBetter: true,
  description: 'Onboarding survey score for the affected group.',
  read: (resolved) => {
    const value = resolved.onboarding?.[key]
    return typeof value === 'number' ? value : null
  },
  reference: referenceRead,
  referenceLabel: 'organisation average',
  sampleOf: (resolved) => resolved.onboarding?.responseCount ?? 0,
})

const exitProbe = (
  key: keyof ExitDivisionMetric & `average${string}`,
  label: string,
  referenceRead: (analytics: HrAnalytics) => MetricValue,
  higherIsBetter = true,
): ProbeSpec => ({
  label: `Exit ${label}`,
  source: 'Exit Survey',
  higherIsBetter,
  description: 'Exit survey score from leavers in the affected group.',
  read: (resolved) => {
    const value = resolved.exit?.[key]
    return typeof value === 'number' ? value : null
  },
  reference: referenceRead,
  referenceLabel: 'company exit average',
  sampleOf: (resolved) => resolved.exit?.exitResponseCount ?? 0,
})

/**
 * Company-wide exit measure. Used when the affected group has too few exit
 * responses of its own; the label says so, so the reader is never shown a
 * company figure dressed up as a group figure.
 */
const companyExitProbe = (
  label: string,
  read: (analytics: HrAnalytics) => MetricValue,
): ProbeSpec => ({
  label: `Exit ${label} · company-wide`,
  source: 'Exit Survey',
  higherIsBetter: true,
  description: 'Company-wide exit survey measure, included because it is weak overall.',
  read: (_resolved, analytics) => read(analytics),
  isFallback: true,
})

/* ----------------------------------------------------------- driver recipes */

type DriverRecipe = {
  category: DriverCategory
  /** Exit reason wording that counts as an extra supporting measure. */
  exitReasonKeyword?: string
  probes: (analytics: HrAnalytics) => ProbeSpec[]
  /** Sentence built from the probes that actually supported the driver. */
  explain: (supporting: readonly Probe[], scopeLabel: string) => string
}

/**
 * Describes a probe the way it actually earned its place. A probe that supports
 * on absolute weakness is never described by its gap — that gap may point the
 * favourable way, and reporting it as support would invert the meaning.
 */
const gapPhrase = (probe: Probe): string => {
  const name = probe.label.toLowerCase()
  if (probe.supportReason === 'gap' && probe.gap !== null) {
    const direction = probe.gap < 0 ? 'lower' : 'higher'
    return `${name} is ${Math.abs(probe.gap).toFixed(2)} points ${direction} than the ${probe.referenceLabel}`
  }
  return `${name} sits at ${probe.value.toFixed(2)} of ${SCORE_SCALE.max}, at or below the weak-score line of ${weakScoreThreshold.toFixed(2)}`
}

const explainFrom = (label: string) =>
  (supporting: readonly Probe[], scopeLabel: string): string => {
    if (supporting.length === 0) return ''
    const parts = supporting.slice(0, 2).map(gapPhrase)
    const sources = [...new Set(supporting.map((probe) => probe.source))]
    const tail =
      sources.length > 1
        ? ` The same pattern appears in ${sources.length} separate datasets.`
        : ''
    return `For ${scopeLabel}, ${parts.join(', and ')}.${tail} ${label} is therefore reported as a related signal, not a proven cause.`
  }

function buildRecipes(analytics: HrAnalytics): DriverRecipe[] {
  const workloadHigherIsBetter = analytics.pulse.workload.direction === 'higherIsBetter'

  return [
    {
      category: 'manager-support',
      exitReasonKeyword: 'manager',
      probes: () => [
        pulseProbe('managerSupport', 'manager support', true),
        onboardingProbe(
          'averageManagerSupport',
          'manager support',
          (a) => a.onboarding.averageManagerSupport,
        ),
        exitProbe('averageManagerSupport', 'manager support', (a) => a.exits.averageManagerSupport),
        companyExitProbe('manager support', (a) => a.exits.averageManagerSupport),
      ],
      explain: explainFrom('Manager support'),
    },
    {
      category: 'career-growth',
      exitReasonKeyword: 'career',
      probes: () => [
        pulseProbe('careerGrowth', 'career growth', true),
        exitProbe(
          'averageCareerOpportunity',
          'career opportunity',
          (a) => a.exits.averageCareerOpportunity,
        ),
        companyExitProbe('career opportunity', (a) => a.exits.averageCareerOpportunity),
      ],
      explain: explainFrom('Career growth'),
    },
    {
      category: 'belonging',
      exitReasonKeyword: 'culture',
      probes: () => [pulseProbe('belonging', 'belonging', true)],
      explain: explainFrom('Belonging'),
    },
    {
      category: 'workload',
      exitReasonKeyword: 'workload',
      probes: () => [
        pulseProbe('workload', 'workload', workloadHigherIsBetter),
        exitProbe('averageWorkload', 'workload', (a) => a.exits.averageWorkload, false),
      ],
      explain: explainFrom('Workload'),
    },
    {
      category: 'role-clarity',
      exitReasonKeyword: 'role',
      probes: () => [
        onboardingProbe('averageRoleClarity', 'role clarity', (a) => a.onboarding.averageRoleClarity),
      ],
      explain: explainFrom('Role clarity'),
    },
    {
      category: 'tools-access',
      probes: () => [
        onboardingProbe('averageToolsAccess', 'tools access', (a) => a.onboarding.averageToolsAccess),
      ],
      explain: explainFrom('Tools access'),
    },
    {
      category: 'onboarding',
      probes: () => [
        onboardingProbe(
          'averageOverallScore',
          'overall experience',
          (a) => a.onboarding.averageOverallScore,
        ),
      ],
      explain: explainFrom('Onboarding experience'),
    },
    {
      category: 'employee-experience',
      probes: () => [
        exitProbe(
          'averageOverallExperience',
          'overall experience',
          (a) => a.exits.averageOverallExperience,
        ),
        companyExitProbe('overall experience', (a) => a.exits.averageOverallExperience),
      ],
      explain: explainFrom('Overall employee experience'),
    },
  ]
}

/* --------------------------------------------------------------- assembling */

const scoreEvidence = (probe: Probe): InsightEvidence => ({
  label: probe.label,
  value: probe.value,
  description: probe.description,
  format: 'score',
  source: probe.source,
  ...(probe.reference !== null ? { comparison: probe.reference } : {}),
  ...(probe.referenceLabel ? { comparisonLabel: probe.referenceLabel } : {}),
})

/** An exit reason with meaningful frequency counts as one supporting measure. */
function exitReasonProbe(
  keyword: string,
  analytics: HrAnalytics,
): { evidence: InsightEvidence; share: number } | null {
  const reason = analytics.exits.reasons.find((entry) =>
    entry.reason.toLowerCase().includes(keyword),
  )
  if (!reason || reason.percentage === null) return null
  if (reason.percentage < relevantExitReasonShare) return null

  return {
    share: reason.percentage,
    evidence: {
      label: `Exit reason · ${reason.reason}`,
      value: reason.count,
      description: `Leavers citing ${reason.reason} as their primary reason (${reason.percentage.toFixed(1)}% of exit responses).`,
      format: 'count',
      source: 'Exit Survey',
    },
  }
}

function isDriverApplicable(category: DriverCategory, scope: InsightScope): boolean {
  if (!ONBOARDING_ONLY_DRIVERS.includes(category)) return true
  return ONBOARDING_DRIVER_SCOPES.includes(scope.kind)
}

export function analyseLikelyDrivers(
  insight: HrInsight,
  analytics: HrAnalytics,
): LikelyDriver[] {
  const resolved = resolveScope(insight.scope, analytics)
  const relevant = DRIVER_RELATIONSHIPS[insight.category]
  const recipes = buildRecipes(analytics).filter(
    (recipe) =>
      relevant.includes(recipe.category) && isDriverApplicable(recipe.category, insight.scope),
  )

  const drivers = recipes.flatMap<LikelyDriver>((recipe) => {
    const probes = preferSpecificProbes(
      recipe
        .probes(analytics)
        .map((spec) => runProbe(spec, resolved, analytics))
        .filter((probe): probe is Probe => probe !== null),
    )

    const supporting = probes.filter((probe) => probe.supporting)
    const reasonProbe = recipe.exitReasonKeyword
      ? exitReasonProbe(recipe.exitReasonKeyword, analytics)
      : null

    /**
     * A company-wide measure describes every group equally, so on its own it
     * cannot single out this group. For a group-scoped issue at least one
     * group-specific measure must be unfavourable before the driver is
     * reported; company-wide figures and exit-reason shares then corroborate it.
     */
    const groupSpecificSupport = supporting.filter((probe) => !probe.isFallback).length
    if (!resolved.isCompany && groupSpecificSupport === 0) return []

    const signalCount = supporting.length + (reasonProbe ? 1 : 0)
    if (signalCount === 0) return []

    const sources = new Set<InsightDataSource>(supporting.map((probe) => probe.source))
    if (reasonProbe) sources.add('Exit Survey')

    const largestGap = supporting.reduce(
      (largest, probe) => Math.max(largest, Math.abs(probe.gap ?? 0)),
      0,
    )

    const strength = classifyEvidenceStrength(signalCount, sources.size, largestGap)
    if (!strength) return []

    return [
      {
        id: `${insight.id}--${recipe.category}`,
        category: recipe.category,
        label: DRIVER_LABELS[recipe.category],
        explanation: recipe.explain(supporting, insight.scope.label),
        evidenceStrength: strength,
        evidence: [
          ...supporting.map(scoreEvidence),
          ...(reasonProbe ? [reasonProbe.evidence] : []),
        ],
        dataSources: [...sources],
        largestGap,
      },
    ]
  })

  return rankDrivers(drivers).slice(0, MAX_VISIBLE_DRIVERS)
}

/**
 * Evidence strength first, then how many datasets agree — the cross-source
 * rule — then the size of the largest gap, then id for stability.
 */
function rankDrivers(drivers: readonly LikelyDriver[]): LikelyDriver[] {
  return [...drivers].sort(
    (a, b) =>
      EVIDENCE_STRENGTH_ORDER[a.evidenceStrength] - EVIDENCE_STRENGTH_ORDER[b.evidenceStrength] ||
      b.dataSources.length - a.dataSources.length ||
      b.largestGap - a.largestGap ||
      a.id.localeCompare(b.id),
  )
}
