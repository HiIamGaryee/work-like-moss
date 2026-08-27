import {
  INSIGHT_THRESHOLDS,
  MAX_VISIBLE_INSIGHTS,
  STRENGTH_ORDER,
  classifySignal,
} from '@/data/hr-insight-rules'
import { NEW_JOINER_MAX_MONTHS, SCORE_SCALE } from '@/data/hr-analytics.constants'
import type {
  ChangeMetric,
  DivisionEmployeeMetric,
  EmployeeCountMetrics,
  HrAnalytics,
  MetricValue,
  OnboardingGroupMetric,
  PulseGroupTrend,
  PulseScoreKey,
  ScoreInterpretation,
} from '@/types/hr-analytics'
import type {
  HrInsight,
  HrInsightResult,
  InsightCategory,
  InsightDataSource,
  InsightDirection,
  InsightEvidence,
  InsightScope,
  InsightStrength,
  InsightSummary,
} from '@/types/hr-insights'
import { round, sortAscending } from '@/utils/analytics'

/**
 * The insight engine.
 *
 *   Analytics (facts)  →  detection (thresholds)  →  template summary  →  HR
 *
 * Nothing here calculates a workforce metric and nothing here invents a number:
 * every value comes from the Step 4 analytics layer. Detection is deterministic,
 * so the same workbook always yields the same insights with the same ids. The
 * `summary` string is the only generated prose, which is what a future LLM would
 * replace — detection, evidence and thresholds would stay exactly as they are.
 *
 * Deliberately absent at this step: cause, priority, and recommended action.
 */

const { minimumGroupSize, minimumResponses } = INSIGHT_THRESHOLDS

/* ------------------------------------------------------------------ helpers */

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

const gapOf = (current: MetricValue, reference: MetricValue): number | null =>
  current === null || reference === null ? null : round(current - reference, 4)

/** Ratio of a group rate to the company rate, e.g. 1.68 = 68% higher. */
const ratioOf = (current: MetricValue, reference: MetricValue): number | null =>
  current === null || reference === null || reference === 0
    ? null
    : round(current / reference, 4)

const directionOf = (gap: number): InsightDirection => (gap > 0 ? 'higher' : 'lower')

/* Scope builders. `key` stays the raw workbook value so the root-cause engine
 * can look the group up in analytics without parsing a sentence. */
const companyScope = (label: string): InsightScope => ({ kind: 'company', key: null, label })
const divisionScope = (name: string): InsightScope => ({ kind: 'division', key: name, label: name })
const employeeGroupScope = (name: string): InsightScope => ({
  kind: 'employee-group',
  key: name,
  label: name,
})
/** `band` must be the raw workbook band, e.g. "13–24 months". */
const tenureBandScope = (band: string): InsightScope => ({
  kind: 'tenure-band',
  key: band,
  label: `${band} tenure`,
})
const NEW_JOINER_SCOPE: InsightScope = {
  kind: 'new-joiners',
  key: null,
  label: `New joiners · first ${NEW_JOINER_MAX_MONTHS} months`,
}

const SCOPE_BUILDERS: Record<string, (name: string) => InsightScope> = {
  division: divisionScope,
  'employee group': employeeGroupScope,
  'tenure band': tenureBandScope,
}

const scoreEvidence = (
  label: string,
  value: MetricValue,
  description: string,
  comparison?: MetricValue,
  comparisonLabel?: string,
): InsightEvidence => ({
  label,
  value: value ?? '—',
  description,
  format: 'score',
  ...(comparison !== undefined && comparison !== null ? { comparison } : {}),
  ...(comparisonLabel ? { comparisonLabel } : {}),
})

/**
 * One normalised sub-signal. Expressing every comparison as `gap / threshold`
 * lets a single classifier rank differences that live on different scales.
 */
type SubSignal = {
  ratio: number
  gap: number
  triggered: boolean
  favourable: boolean
}

function subSignal(gap: number | null, threshold: number, higherIsBetter: boolean): SubSignal | null {
  if (gap === null || threshold <= 0) return null
  const ratio = Math.abs(gap) / threshold
  const favourable = higherIsBetter ? gap > 0 : gap < 0
  return { ratio, gap, triggered: ratio >= 1, favourable }
}

/**
 * Favourable differences must clear the full threshold — good news is reported,
 * but the watch band is reserved for differences worth monitoring.
 */
function classifyCombined(signals: readonly SubSignal[]): {
  strength: InsightStrength
  driver: SubSignal
} | null {
  if (signals.length === 0) return null

  const driver = [...signals].sort((a, b) => b.ratio - a.ratio)[0]
  if (!driver) return null

  const strength = classifySignal(driver.ratio, 1, signals.filter((s) => s.triggered).length)
  if (!strength) return null
  if (driver.favourable && strength === 'watch') return null

  return { strength, driver }
}

type DetectionContext = {
  analytics: HrAnalytics
  suppressed: string[]
}

const meetsSample = (
  context: DetectionContext,
  size: number,
  minimum: number,
  scope: string,
  what: string,
): boolean => {
  if (size >= minimum) return true
  context.suppressed.push(
    `${scope}: ${what} withheld — ${size} below the ${minimum} minimum sample.`,
  )
  return false
}

/* ---------------------------------------------- 1. company pulse trend */

function detectCompanyPulseSignals({ analytics }: DetectionContext): HrInsight[] {
  const change: ChangeMetric | null = analytics.pulse.engagementChange
  if (!change || change.absoluteChange === null || change.direction === 'flat') return []

  const declining = change.absoluteChange < 0
  const threshold = declining
    ? INSIGHT_THRESHOLDS.pulseDecline
    : INSIGHT_THRESHOLDS.pulseImprovement

  const signal = subSignal(change.absoluteChange, threshold, true)
  const classified = signal ? classifyCombined([signal]) : null
  if (!classified) return []

  return [
    {
      id: 'engagement-company-pulse-trend',
      category: 'engagement',
      title: declining ? 'Pulse engagement is declining' : 'Pulse engagement is improving',
      summary: `Company engagement moved ${change.absoluteChange.toFixed(2)} points between ${change.fromLabel} and ${change.toLabel}.`,
      affectedScope: 'Company-wide',
      scope: companyScope('Company-wide'),
      isFavourable: !declining,
      severity: { gap: Math.abs(change.absoluteChange), kind: 'score' },
      signalStrength: classified.strength,
      direction: declining ? 'down' : 'up',
      metricLabel: 'Pulse engagement',
      currentValue: change.to,
      referenceValue: change.from,
      difference: change.absoluteChange,
      sampleSize: analytics.pulse.responseCount,
      sampleLabel: 'pulse responses',
      evidence: [
        scoreEvidence(`First wave (${change.fromLabel})`, change.from, 'Earliest recorded wave.'),
        scoreEvidence(`Latest wave (${change.toLabel})`, change.to, 'Most recent recorded wave.'),
        {
          label: 'Change',
          value: change.absoluteChange,
          description: 'Difference between the earliest and latest wave.',
          format: 'delta',
        },
        {
          label: 'Responses',
          value: analytics.pulse.responseCount,
          description: 'Pulse responses across all waves.',
          format: 'count',
        },
      ],
      dataSources: ['Pulse Survey'],
      detectionRule: `Engagement moved ${Math.abs(change.absoluteChange).toFixed(2)} points across the pulse period, at or above the configured ${threshold.toFixed(2)}-point movement threshold.`,
    },
  ]
}

/* ------------------------------------------- 2. division engagement signals */

function detectDivisionEngagementSignals(context: DetectionContext): HrInsight[] {
  const { analytics } = context
  const companyLatest = analytics.overview.latestPulse.engagement
  const companyBase = analytics.employees.averageBaseEngagement

  return analytics.divisions.flatMap<HrInsight>((division) => {
    const employees = division.employees
    const pulse = division.pulse
    if (!pulse?.latest) return []

    if (
      !meetsSample(
        context,
        employees.employeeCount,
        minimumGroupSize,
        division.division,
        'engagement comparison',
      )
    ) {
      return []
    }
    if (
      !meetsSample(
        context,
        pulse.latest.responseCount,
        minimumResponses,
        division.division,
        'engagement comparison',
      )
    ) {
      return []
    }

    const latestGap = gapOf(pulse.latest.engagement, companyLatest)
    const firstWave = pulse.trend.find((point) => point.responseCount > 0) ?? null
    const trendGap =
      firstWave && firstWave.wave !== pulse.latest.wave
        ? gapOf(pulse.latest.engagement, firstWave.engagement)
        : null
    const baseGap = gapOf(employees.averageBaseEngagement, companyBase)

    const signals = [
      subSignal(latestGap, INSIGHT_THRESHOLDS.groupEngagementGap, true),
      subSignal(trendGap, INSIGHT_THRESHOLDS.pulseDecline, true),
      subSignal(baseGap, INSIGHT_THRESHOLDS.baseEngagementGap, true),
    ].filter((signal): signal is SubSignal => signal !== null)

    const classified = classifyCombined(signals)
    if (!classified || latestGap === null) return []

    const below = latestGap < 0
    const declining = trendGap !== null && trendGap < 0 && Math.abs(trendGap) >= INSIGHT_THRESHOLDS.pulseDecline

    const title = declining
      ? `${division.division} engagement is below the company average and declining`
      : `${division.division} engagement is ${below ? 'below' : 'above'} the company average`

    const evidence: InsightEvidence[] = [
      scoreEvidence(
        `${division.division} latest engagement`,
        pulse.latest.engagement,
        `Latest wave ${pulse.latest.wave}.`,
        companyLatest,
        'company latest wave',
      ),
      {
        label: 'Difference vs company',
        value: latestGap,
        description: 'Division latest engagement minus the company latest engagement.',
        format: 'delta',
      },
      {
        label: 'Responses in latest wave',
        value: pulse.latest.responseCount,
        description: `Pulse responses from ${division.division} in ${pulse.latest.wave}.`,
        format: 'count',
      },
      {
        label: 'Employees',
        value: employees.employeeCount,
        description: `Employees recorded in ${division.division}.`,
        format: 'count',
      },
    ]

    if (trendGap !== null) {
      evidence.push({
        label: 'Change across waves',
        value: trendGap,
        description: `Movement from ${firstWave?.wave ?? 'the first wave'} to ${pulse.latest.wave}.`,
        format: 'delta',
      })
    }
    if (baseGap !== null) {
      evidence.push({
        label: 'Base engagement',
        value: employees.averageBaseEngagement ?? '—',
        comparison: companyBase ?? undefined,
        comparisonLabel: 'company average',
        description: 'Baseline engagement recorded per employee, 0–1 scale.',
        format: 'ratio',
      })
    }

    return [
      {
        id: `engagement-division-${slug(division.division)}`,
        category: 'engagement',
        title,
        summary: `${division.division} engagement is ${Math.abs(latestGap).toFixed(2)} points ${below ? 'below' : 'above'} the latest company average.`,
        affectedScope: division.division,
        scope: divisionScope(division.division),
        isFavourable: !below,
        severity: { gap: Math.abs(latestGap), kind: 'score' },
        signalStrength: classified.strength,
        direction: directionOf(latestGap),
        metricLabel: 'Pulse engagement',
        currentValue: pulse.latest.engagement,
        referenceValue: companyLatest,
        difference: latestGap,
        sampleSize: employees.employeeCount,
        sampleLabel: 'employees',
        evidence,
        dataSources: ['Pulse Survey', 'Employees'],
        detectionRule: buildGapRule(
          `${division.division} latest engagement`,
          latestGap,
          INSIGHT_THRESHOLDS.groupEngagementGap,
        ),
      },
    ]
  })
}

function buildGapRule(subject: string, gap: number, threshold: number): string {
  return `${subject} is ${Math.abs(gap).toFixed(2)} points ${gap < 0 ? 'below' : 'above'} the comparison figure, against a configured ${threshold.toFixed(2)}-point threshold.`
}

/* ------------------------------------------------- 3. tenure band signals */

const PULSE_SCORE_META: readonly {
  key: PulseScoreKey
  label: string
  category: InsightCategory
}[] = [
  { key: 'engagement', label: 'Engagement', category: 'engagement' },
  { key: 'managerSupport', label: 'Manager support', category: 'manager-support' },
  { key: 'careerGrowth', label: 'Career growth', category: 'career-growth' },
  { key: 'belonging', label: 'Belonging', category: 'belonging' },
  { key: 'workload', label: 'Workload', category: 'workload' },
]

/** Higher is better for every pulse dimension except workload, whose direction the workbook defines. */
const higherIsBetterFor = (key: PulseScoreKey, workload: ScoreInterpretation): boolean =>
  key === 'workload' ? workload.direction === 'higherIsBetter' : true

function detectTenureBandSignals(context: DetectionContext): HrInsight[] {
  const { analytics } = context
  const companyLatest = analytics.overview.latestPulse.engagement

  return analytics.pulse.byTenureBand.flatMap<HrInsight>((band) => {
    if (!band.latest) return []
    if (
      !meetsSample(
        context,
        band.responseCount,
        minimumResponses,
        band.group,
        'tenure engagement comparison',
      )
    ) {
      return []
    }

    const firstWave = band.trend.find((point) => point.responseCount > 0) ?? null
    const trendGap =
      firstWave && firstWave.wave !== band.latest.wave
        ? gapOf(band.latest.engagement, firstWave.engagement)
        : null
    const latestGap = gapOf(band.latest.engagement, companyLatest)

    const signals = [
      subSignal(trendGap, INSIGHT_THRESHOLDS.pulseDecline, true),
      subSignal(latestGap, INSIGHT_THRESHOLDS.groupEngagementGap, true),
    ].filter((signal): signal is SubSignal => signal !== null)

    const classified = classifyCombined(signals)
    if (!classified || trendGap === null) return []

    const declining = trendGap < 0
    const isNewJoinerBand = band.group.startsWith('0–')

    return [
      {
        id: `engagement-tenure-${slug(band.group)}`,
        category: 'engagement',
        title: `Engagement is ${declining ? 'declining' : 'improving'} among employees at ${band.group}`,
        summary: `${isNewJoinerBand ? 'New joiners' : `Employees at ${band.group}`} moved ${trendGap.toFixed(2)} points across the pulse period, while the company overall stayed within its movement threshold.`,
        affectedScope: `${band.group} tenure`,
        scope: isNewJoinerBand ? NEW_JOINER_SCOPE : tenureBandScope(band.group),
        isFavourable: !declining,
        severity: { gap: Math.abs(trendGap), kind: 'score' },
        signalStrength: classified.strength,
        direction: declining ? 'down' : 'up',
        metricLabel: 'Pulse engagement',
        currentValue: band.latest.engagement,
        referenceValue: firstWave?.engagement ?? null,
        difference: trendGap,
        sampleSize: band.responseCount,
        sampleLabel: 'pulse responses',
        evidence: [
          scoreEvidence(
            `First wave (${firstWave?.wave ?? '—'})`,
            firstWave?.engagement ?? null,
            'Earliest wave answered by this tenure band.',
          ),
          scoreEvidence(
            `Latest wave (${band.latest.wave})`,
            band.latest.engagement,
            'Most recent wave answered by this tenure band.',
            companyLatest,
            'company latest wave',
          ),
          {
            label: 'Change across waves',
            value: trendGap,
            description: 'Movement between the first and latest wave for this band.',
            format: 'delta',
          },
          {
            label: 'Responses',
            value: band.responseCount,
            description: 'Pulse responses from this tenure band.',
            format: 'count',
          },
        ],
        dataSources: ['Pulse Survey', 'Employees'],
        detectionRule: `Engagement for this tenure band moved ${Math.abs(trendGap).toFixed(2)} points across the pulse period, against a configured ${INSIGHT_THRESHOLDS.pulseDecline.toFixed(2)}-point movement threshold.`,
      },
    ]
  })
}

/* ------------------------------------------------- 4. new joiner signals */

function detectNewJoinerSignals(context: DetectionContext): HrInsight[] {
  const { analytics } = context
  const comparison = analytics.pulse.newJoinerComparison
  const onboarding = analytics.onboarding.newJoiners
  const insights: HrInsight[] = []

  if (
    comparison &&
    meetsSample(
      context,
      comparison.newJoiners.responseCount,
      minimumResponses,
      'New joiners',
      'pulse comparison',
    )
  ) {
    const scored = PULSE_SCORE_META.map((meta) => {
      const gap = comparison.difference[meta.key]
      return {
        meta,
        gap,
        signal: subSignal(
          gap,
          INSIGHT_THRESHOLDS.groupScoreGap,
          higherIsBetterFor(meta.key, analytics.pulse.workload),
        ),
      }
    }).filter((entry) => entry.signal !== null)

    const signals = scored.map((entry) => entry.signal).filter((s): s is SubSignal => s !== null)
    const classified = classifyCombined(signals)
    const driving = scored.find((entry) => entry.signal === classified?.driver)

    if (classified && driving && driving.gap !== null) {
      const lower = driving.gap < 0
      insights.push({
        id: `new-joiner-pulse-${slug(driving.meta.label)}`,
        category: driving.meta.category,
        title: `${driving.meta.label} is ${lower ? 'lower' : 'higher'} among new joiners`,
        summary: `Employees within their first ${NEW_JOINER_MAX_MONTHS} months report ${driving.meta.label.toLowerCase()} ${Math.abs(driving.gap).toFixed(2)} points ${lower ? 'below' : 'above'} longer-tenured colleagues.`,
        affectedScope: NEW_JOINER_SCOPE.label,
        scope: NEW_JOINER_SCOPE,
        isFavourable: classified.driver.favourable,
        severity: { gap: Math.abs(driving.gap), kind: 'score' },
        signalStrength: classified.strength,
        direction: directionOf(driving.gap),
        metricLabel: driving.meta.label,
        currentValue: comparison.newJoiners.averages[driving.meta.key],
        referenceValue: comparison.others.averages[driving.meta.key],
        difference: driving.gap,
        sampleSize: comparison.newJoiners.responseCount,
        sampleLabel: 'pulse responses from new joiners',
        evidence: [
          ...scored
            .filter((entry) => entry.signal?.triggered)
            .map((entry) =>
              scoreEvidence(
                entry.meta.label,
                comparison.newJoiners.averages[entry.meta.key],
                'New joiner score against longer-tenured employees.',
                comparison.others.averages[entry.meta.key],
                'over 6 months',
              ),
            ),
          {
            label: 'New joiner responses',
            value: comparison.newJoiners.responseCount,
            description: 'Pulse responses from employees inside the new joiner window.',
            format: 'count',
          },
          {
            label: 'Comparison responses',
            value: comparison.others.responseCount,
            description: 'Pulse responses from longer-tenured employees.',
            format: 'count',
          },
        ],
        dataSources: ['Pulse Survey', 'Employees'],
        detectionRule: buildGapRule(
          `New joiner ${driving.meta.label.toLowerCase()}`,
          driving.gap,
          INSIGHT_THRESHOLDS.groupScoreGap,
        ),
      })
    }
  }

  const onboardingInsight = detectNewJoinerOnboardingSignal(context, onboarding)
  if (onboardingInsight) insights.push(onboardingInsight)

  const retentionInsight = detectNewJoinerRetentionSignal(context)
  if (retentionInsight) insights.push(retentionInsight)

  return insights
}

function detectNewJoinerOnboardingSignal(
  context: DetectionContext,
  onboarding: OnboardingGroupMetric | null,
): HrInsight | null {
  const { analytics } = context
  if (!onboarding) return null
  if (
    !meetsSample(
      context,
      onboarding.responseCount,
      minimumResponses,
      'New joiners',
      'onboarding comparison',
    )
  ) {
    return null
  }

  const gap = gapOf(onboarding.averageOverallScore, analytics.onboarding.averageOverallScore)
  const signal = subSignal(gap, INSIGHT_THRESHOLDS.onboardingGap, true)
  const classified = signal ? classifyCombined([signal]) : null
  if (!classified || gap === null) return null

  const below = gap < 0
  return {
    id: 'onboarding-new-joiner-gap',
    category: 'onboarding',
    title: `New joiner onboarding scores are ${below ? 'below' : 'above'} the organisation average`,
    summary: `Onboarding responses from employees inside their first ${NEW_JOINER_MAX_MONTHS} months sit ${Math.abs(gap).toFixed(2)} points ${below ? 'below' : 'above'} the organisation average.`,
    affectedScope: NEW_JOINER_SCOPE.label,
    scope: NEW_JOINER_SCOPE,
    isFavourable: !below,
    severity: { gap: Math.abs(gap), kind: 'score' },
    signalStrength: classified.strength,
    direction: directionOf(gap),
    metricLabel: 'Onboarding overall score',
    currentValue: onboarding.averageOverallScore,
    referenceValue: analytics.onboarding.averageOverallScore,
    difference: gap,
    sampleSize: onboarding.responseCount,
    sampleLabel: 'onboarding responses',
    evidence: [
      scoreEvidence(
        'New joiner onboarding',
        onboarding.averageOverallScore,
        'Overall onboarding score for current new joiners.',
        analytics.onboarding.averageOverallScore,
        'organisation average',
      ),
      {
        label: 'Responses',
        value: onboarding.responseCount,
        description: 'Onboarding responses inside the new joiner window.',
        format: 'count',
      },
    ],
    dataSources: ['Onboarding Survey', 'Employees'],
    detectionRule: buildGapRule('New joiner onboarding', gap, INSIGHT_THRESHOLDS.onboardingGap),
  }
}

/**
 * Group-level leaver share only. This never estimates whether any individual
 * will leave, and the wording stays descriptive rather than predictive.
 */
function detectNewJoinerRetentionSignal(context: DetectionContext): HrInsight | null {
  const { analytics } = context
  const newJoiners = analytics.employees.newJoiners
  const companyRate = analytics.employees.leaverRate

  if (
    !meetsSample(
      context,
      newJoiners.newJoinerCount,
      minimumGroupSize,
      'New joiners',
      'leaver share comparison',
    )
  ) {
    return null
  }

  const ratio = ratioOf(newJoiners.newJoinerLeaverRate, companyRate)
  const signal = subSignal(
    ratio === null ? null : ratio - 1,
    INSIGHT_THRESHOLDS.leaverRateMultiplier - 1,
    false,
  )
  const classified = signal ? classifyCombined([signal]) : null
  if (!classified || ratio === null) return null

  const higher = ratio > 1
  return {
    id: 'retention-new-joiner-share',
    category: 'retention',
    title: `Leaver share is ${higher ? 'higher' : 'lower'} among employees in their first ${NEW_JOINER_MAX_MONTHS} months`,
    summary: `The leaver share among employees within the first ${NEW_JOINER_MAX_MONTHS} months is ${higher ? 'higher' : 'lower'} than the dataset leaver rate.`,
    affectedScope: NEW_JOINER_SCOPE.label,
    scope: NEW_JOINER_SCOPE,
    isFavourable: !higher,
    severity: {
      gap: Math.abs(gapOf(newJoiners.newJoinerLeaverRate, companyRate) ?? 0),
      kind: 'rate',
    },
    signalStrength: classified.strength,
    direction: higher ? 'higher' : 'lower',
    metricLabel: 'Leaver rate',
    currentValue: newJoiners.newJoinerLeaverRate,
    referenceValue: companyRate,
    difference: gapOf(newJoiners.newJoinerLeaverRate, companyRate),
    sampleSize: newJoiners.newJoinerCount,
    sampleLabel: 'employees',
    evidence: [
      {
        label: 'New joiner leaver rate',
        value: newJoiners.newJoinerLeaverRate ?? '—',
        comparison: companyRate ?? undefined,
        comparisonLabel: 'dataset leaver rate',
        description: 'Share of new joiners in the dataset marked as Leaver.',
        format: 'percentage',
      },
      {
        label: 'New joiners',
        value: newJoiners.newJoinerCount,
        description: 'Employees inside the new joiner window.',
        format: 'count',
      },
      {
        label: 'Leavers in group',
        value: newJoiners.newJoinerLeaverCount,
        description: 'New joiners marked as Leaver.',
        format: 'count',
      },
    ],
    dataSources: ['Employees'],
    detectionRule: `The group leaver rate is ${ratio.toFixed(2)}× the dataset rate, against a configured ${INSIGHT_THRESHOLDS.leaverRateMultiplier.toFixed(2)}× threshold.`,
  }
}

/* -------------------------------------------------- 5. onboarding signals */

function detectOnboardingSignals(context: DetectionContext): HrInsight[] {
  const { analytics } = context
  const onboarding = analytics.onboarding
  const insights: HrInsight[] = []

  const weakest = onboarding.weakestDimension
  const strongest = onboarding.dimensions[onboarding.dimensions.length - 1] ?? null

  if (weakest && weakest.score !== null) {
    const spread = gapOf(weakest.score, strongest?.score ?? null)
    const clearlyWeak = weakest.score <= INSIGHT_THRESHOLDS.weakSurveyScore
    const spreadClears =
      spread !== null && Math.abs(spread) >= INSIGHT_THRESHOLDS.groupScoreGap

    if (clearlyWeak || spreadClears) {
      const strength: InsightStrength =
        clearlyWeak && spreadClears
          ? 'strong'
          : weakest.score <= INSIGHT_THRESHOLDS.weakSurveyScore - INSIGHT_THRESHOLDS.groupScoreGap
            ? 'strong'
            : 'moderate'

      insights.push({
        id: `onboarding-weakest-${slug(weakest.label)}`,
        category: 'onboarding',
        title: `${weakest.label} is the weakest onboarding dimension`,
        summary: `${weakest.label} records the lowest onboarding score at ${weakest.score.toFixed(2)} of ${SCORE_SCALE.max}.`,
        affectedScope: 'Company-wide onboarding',
        scope: companyScope('Company-wide onboarding'),
        isFavourable: false,
        // Absolute weakness: the shortfall below the weak-score line, not a group gap.
        severity: {
          gap: Math.max(0, INSIGHT_THRESHOLDS.weakSurveyScore - weakest.score),
          kind: 'score',
        },
        signalStrength: strength,
        direction: 'lower',
        metricLabel: weakest.label,
        currentValue: weakest.score,
        referenceValue: onboarding.averageOverallScore,
        difference: gapOf(weakest.score, onboarding.averageOverallScore),
        sampleSize: onboarding.responseCount,
        sampleLabel: 'onboarding responses',
        evidence: [
          ...onboarding.dimensions.map((dimension) =>
            scoreEvidence(
              dimension.label,
              dimension.score,
              'Onboarding dimension average across all responses.',
            ),
          ),
          scoreEvidence(
            'Overall onboarding',
            onboarding.averageOverallScore,
            'Overall onboarding score across all responses.',
          ),
          {
            label: 'Responses',
            value: onboarding.responseCount,
            description: 'Onboarding survey responses.',
            format: 'count',
          },
        ],
        dataSources: ['Onboarding Survey'],
        detectionRule: clearlyWeak
          ? `${weakest.label} scores ${weakest.score.toFixed(2)}, at or below the configured weak-score line of ${INSIGHT_THRESHOLDS.weakSurveyScore.toFixed(2)}.`
          : `${weakest.label} sits ${Math.abs(spread ?? 0).toFixed(2)} points below the strongest dimension, above the configured ${INSIGHT_THRESHOLDS.groupScoreGap.toFixed(2)}-point spread threshold.`,
      })
    }
  }

  insights.push(...detectDivisionOnboardingSignals(context))
  return insights
}

function detectDivisionOnboardingSignals(context: DetectionContext): HrInsight[] {
  const { analytics } = context
  const companyScore = analytics.onboarding.averageOverallScore

  return analytics.onboarding.byDivision.flatMap<HrInsight>((division) => {
    if (
      !meetsSample(
        context,
        division.responseCount,
        minimumResponses,
        division.group,
        'onboarding comparison',
      )
    ) {
      return []
    }

    const gap = gapOf(division.averageOverallScore, companyScore)
    const signal = subSignal(gap, INSIGHT_THRESHOLDS.onboardingGap, true)
    const classified = signal ? classifyCombined([signal]) : null
    if (!classified || gap === null) return []

    const below = gap < 0
    return [
      {
        id: `onboarding-division-${slug(division.group)}`,
        category: 'onboarding',
        title: `${division.group} onboarding scores are ${below ? 'below' : 'above'} the organisation average`,
        summary: `${division.group} records an overall onboarding score ${Math.abs(gap).toFixed(2)} points ${below ? 'below' : 'above'} the organisation average.`,
        affectedScope: division.group,
        scope: divisionScope(division.group),
        isFavourable: !below,
        severity: { gap: Math.abs(gap), kind: 'score' },
        signalStrength: classified.strength,
        direction: directionOf(gap),
        metricLabel: 'Onboarding overall score',
        currentValue: division.averageOverallScore,
        referenceValue: companyScore,
        difference: gap,
        sampleSize: division.responseCount,
        sampleLabel: 'onboarding responses',
        evidence: [
          scoreEvidence(
            `${division.group} onboarding`,
            division.averageOverallScore,
            'Overall onboarding score for this division.',
            companyScore,
            'organisation average',
          ),
          scoreEvidence(
            'Manager support',
            division.averageManagerSupport,
            'Division onboarding manager support.',
            analytics.onboarding.averageManagerSupport,
            'organisation average',
          ),
          scoreEvidence(
            'Role clarity',
            division.averageRoleClarity,
            'Division onboarding role clarity.',
            analytics.onboarding.averageRoleClarity,
            'organisation average',
          ),
          scoreEvidence(
            'Tools access',
            division.averageToolsAccess,
            'Division onboarding tools access.',
            analytics.onboarding.averageToolsAccess,
            'organisation average',
          ),
          {
            label: 'Responses',
            value: division.responseCount,
            description: `Onboarding responses from ${division.group}.`,
            format: 'count',
          },
        ],
        dataSources: ['Onboarding Survey', 'Employees'],
        detectionRule: buildGapRule(
          `${division.group} onboarding`,
          gap,
          INSIGHT_THRESHOLDS.onboardingGap,
        ),
      },
    ]
  })
}

/* --------------------------------------------------- 6. retention signals */

/**
 * `scope` is the display name; `key` is the raw workbook value. Tenure bands
 * differ between the two ("13–24 months tenure" vs "13–24 months"), and the
 * priority engine looks groups up by the raw value.
 */
type LeaverGroup = {
  scope: string
  key: string
  label: string
  metrics: EmployeeCountMetrics
}

/**
 * Reading form of a group name, with the verb that agrees with it. `scope` stays
 * the raw workbook value so de-duplication still matches across detectors, while
 * sentences read naturally — "the Manager employee group has", not "Manager has".
 */
function describeGroup(scope: string, label: string): { subject: string; verb: string } {
  if (label === 'employee group') return { subject: `the ${scope} employee group`, verb: 'has' }
  if (label === 'tenure band') {
    return { subject: `employees at ${scope.replace(' tenure', '')}`, verb: 'have' }
  }
  return { subject: scope, verb: 'has' }
}

function detectRetentionSignals(context: DetectionContext): HrInsight[] {
  const { analytics } = context
  const companyRate = analytics.employees.leaverRate

  const groups: LeaverGroup[] = [
    ...analytics.employees.byDivision.map((entry: DivisionEmployeeMetric) => ({
      scope: entry.division,
      key: entry.division,
      label: 'division',
      metrics: entry,
    })),
    ...analytics.employees.byEmployeeGroup.map((entry) => ({
      scope: entry.group,
      key: entry.group,
      label: 'employee group',
      metrics: entry,
    })),
    ...analytics.employees.byTenureBand.map((entry) => ({
      scope: `${entry.band} tenure`,
      key: entry.band,
      label: 'tenure band',
      metrics: entry,
    })),
  ]

  return groups.flatMap<HrInsight>(({ scope, key, label, metrics }) => {
    if (
      !meetsSample(context, metrics.employeeCount, minimumGroupSize, scope, 'leaver comparison')
    ) {
      return []
    }

    const ratio = ratioOf(metrics.leaverRate, companyRate)
    const signal = subSignal(
      ratio === null ? null : ratio - 1,
      INSIGHT_THRESHOLDS.leaverRateMultiplier - 1,
      false,
    )
    const classified = classifyCombined(signal ? [signal] : [])
    if (!classified || ratio === null || metrics.leaverRate === null) return []

    const higher = ratio > 1
    const isTopRate = analytics.employees.highestLeaverRateDivision?.division === scope
    const concentrated = higher && classified.strength === 'strong'

    const { subject, verb } = describeGroup(scope, label)
    const title = concentrated
      ? `Leavers are disproportionately concentrated in ${subject}`
      : `${capitalise(subject)} ${verb} a ${higher ? 'higher' : 'lower'} leaver rate than the dataset average`

    return [
      {
        id: `retention-${slug(label)}-${slug(scope)}`,
        category: 'retention',
        title,
        summary: `${capitalise(subject)} ${verb === 'have' ? 'record' : 'records'} a leaver rate of ${metrics.leaverRate.toFixed(1)}%, ${ratio.toFixed(2)}× the dataset rate.${isTopRate ? ' This is the highest division leaver rate in the dataset.' : ''}`,
        affectedScope: scope,
        scope: (SCOPE_BUILDERS[label] ?? divisionScope)(key),
        isFavourable: !higher,
        severity: { gap: Math.abs(gapOf(metrics.leaverRate, companyRate) ?? 0), kind: 'rate' },
        signalStrength: classified.strength,
        direction: higher ? 'higher' : 'lower',
        metricLabel: 'Leaver rate',
        currentValue: metrics.leaverRate,
        referenceValue: companyRate,
        difference: gapOf(metrics.leaverRate, companyRate),
        sampleSize: metrics.employeeCount,
        sampleLabel: 'employees',
        evidence: [
          {
            label: `${scope} leaver rate`,
            value: metrics.leaverRate,
            comparison: companyRate ?? undefined,
            comparisonLabel: 'dataset leaver rate',
            description: 'Share of this group in the dataset marked as Leaver.',
            format: 'percentage',
          },
          {
            label: 'Leavers',
            value: metrics.leaverCount,
            description: `Employees in ${scope} marked as Leaver.`,
            format: 'count',
          },
          {
            label: 'Employees',
            value: metrics.employeeCount,
            description: `Employees recorded in ${scope}.`,
            format: 'count',
          },
          {
            label: 'Relative to dataset',
            value: ratio,
            description: 'Group leaver rate divided by the dataset leaver rate.',
            format: 'multiplier',
          },
        ],
        dataSources: ['Employees'],
        detectionRule: `${capitalise(subject)} ${verb} a leaver rate ${ratio.toFixed(2)}× the dataset rate, against a configured ${INSIGHT_THRESHOLDS.leaverRateMultiplier.toFixed(2)}× threshold.`,
      },
    ]
  })
}

/* --------------------------------------------------- 7. workplace signals */

/**
 * Manager support, workload, career growth and belonging by division and
 * employee group. Workload orientation comes from the workbook definition, so a
 * higher score is never assumed to be the better outcome.
 */
function detectWorkplaceSignals(context: DetectionContext): HrInsight[] {
  const { analytics } = context
  const workload = analytics.pulse.workload
  const companyLatest = analytics.overview.latestPulse

  const groups: { scope: string; label: string; trend: PulseGroupTrend }[] = [
    ...analytics.pulse.byDivision.map((entry) => ({
      scope: entry.group,
      label: 'division',
      trend: entry,
    })),
    ...analytics.pulse.byEmployeeGroup.map((entry) => ({
      scope: entry.group,
      label: 'employee group',
      trend: entry,
    })),
  ]

  const dimensions = PULSE_SCORE_META.filter((meta) => meta.key !== 'engagement')

  return groups.flatMap<HrInsight>(({ scope, label, trend }) => {
    const latest = trend.latest
    if (!latest) return []
    if (!meetsSample(context, latest.responseCount, minimumResponses, scope, 'workplace comparison'))
      return []

    const scored = dimensions
      .map((meta) => {
        const gap = gapOf(latest[meta.key], companyLatest[meta.key])
        return {
          meta,
          gap,
          signal: subSignal(
            gap,
            INSIGHT_THRESHOLDS.groupScoreGap,
            higherIsBetterFor(meta.key, workload),
          ),
        }
      })
      .filter((entry) => entry.signal !== null)

    const classified = classifyCombined(
      scored.map((entry) => entry.signal).filter((s): s is SubSignal => s !== null),
    )
    const driving = scored.find((entry) => entry.signal === classified?.driver)
    if (!classified || !driving || driving.gap === null) return []

    const higher = driving.gap > 0
    const isWorkload = driving.meta.key === 'workload'
    const title = isWorkload
      ? `Reported workload pressure is ${higher ? 'higher' : 'lower'} in ${scope}`
      : `${driving.meta.label} is ${higher ? 'higher' : 'lower'} in ${scope}`

    return [
      {
        id: `${slug(driving.meta.category)}-${slug(label)}-${slug(scope)}`,
        category: driving.meta.category,
        title,
        summary: `${scope} reports ${driving.meta.label.toLowerCase()} ${Math.abs(driving.gap).toFixed(2)} points ${higher ? 'above' : 'below'} the latest company average.`,
        affectedScope: scope,
        scope: (SCOPE_BUILDERS[label] ?? divisionScope)(scope),
        isFavourable: classified.driver.favourable,
        severity: { gap: Math.abs(driving.gap), kind: 'score' },
        signalStrength: classified.strength,
        direction: directionOf(driving.gap),
        metricLabel: driving.meta.label,
        currentValue: latest[driving.meta.key],
        referenceValue: companyLatest[driving.meta.key],
        difference: driving.gap,
        sampleSize: latest.responseCount,
        sampleLabel: 'pulse responses in latest wave',
        evidence: [
          ...scored
            .filter((entry) => entry.signal?.triggered)
            .map((entry) =>
              scoreEvidence(
                entry.meta.label,
                latest[entry.meta.key],
                isWorkload && entry.meta.key === 'workload' && workload.description
                  ? workload.description
                  : 'Latest wave score against the company latest wave.',
                companyLatest[entry.meta.key],
                'company latest wave',
              ),
            ),
          {
            label: 'Responses in latest wave',
            value: latest.responseCount,
            description: `Pulse responses from ${scope} in ${latest.wave}.`,
            format: 'count',
          },
        ],
        dataSources: ['Pulse Survey', 'Employees'],
        detectionRule: buildGapRule(
          `${scope} ${driving.meta.label.toLowerCase()}`,
          driving.gap,
          INSIGHT_THRESHOLDS.groupScoreGap,
        ),
      },
    ]
  })
}

/* -------------------------------------------------------- 8. exit signals */

function detectExitSignals({ analytics }: DetectionContext): HrInsight[] {
  const exits = analytics.exits
  const top = exits.topExitReasons[0]
  if (!top || top.percentage === null) return []
  if (top.percentage < INSIGHT_THRESHOLDS.notableExitReasonShare) return []

  const substantial = top.percentage >= INSIGHT_THRESHOLDS.majorExitReasonShare
  const runnerUp = exits.topExitReasons[1] ?? null
  const negativeRecommendation = exits.wouldRecommend.find((entry) => entry.group === 'No') ?? null

  return [
    {
      id: `exit-reason-${slug(top.reason)}`,
      category: 'exit',
      title: `${top.reason} is the most common reported exit reason`,
      summary: `${top.reason} accounts for ${top.percentage.toFixed(1)}% of recorded exit survey responses.`,
      affectedScope: 'Company-wide exits',
      scope: companyScope('Company-wide exits'),
      isFavourable: false,
      severity: { gap: top.percentage, kind: 'share' },
      signalStrength: substantial ? 'strong' : 'moderate',
      direction: 'higher',
      metricLabel: 'Share of exit responses',
      currentValue: top.percentage,
      referenceValue: runnerUp?.percentage ?? null,
      difference: gapOf(top.percentage, runnerUp?.percentage ?? null),
      sampleSize: exits.responseCount,
      sampleLabel: 'exit survey responses',
      evidence: [
        {
          label: top.reason,
          value: top.count,
          description: `Exit responses citing ${top.reason} as the primary reason.`,
          format: 'count',
        },
        {
          label: 'Share of responses',
          value: top.percentage,
          description: 'Percentage of exit survey responses citing this reason.',
          format: 'percentage',
        },
        ...(runnerUp
          ? [
              {
                label: `Next reason · ${runnerUp.reason}`,
                value: runnerUp.count,
                description: 'The second most common recorded reason, for comparison.',
                format: 'count' as const,
              },
            ]
          : []),
        ...(negativeRecommendation
          ? [
              {
                label: 'Would not recommend',
                value: negativeRecommendation.count,
                description: 'Leavers answering "No" to would-recommend.',
                format: 'count' as const,
              },
            ]
          : []),
        {
          label: 'Exit responses',
          value: exits.responseCount,
          description: 'Total exit survey responses in the dataset.',
          format: 'count',
        },
      ],
      dataSources: ['Exit Survey'],
      detectionRule: substantial
        ? `${top.reason} accounts for ${top.percentage.toFixed(1)}% of exit responses, above the configured ${INSIGHT_THRESHOLDS.majorExitReasonShare}% concentration threshold.`
        : `${top.reason} leads all recorded exit reasons at ${top.percentage.toFixed(1)}%, above the configured ${INSIGHT_THRESHOLDS.notableExitReasonShare}% reporting threshold.`,
    },
  ]
}

/* ------------------------------------------------ 9. cross-source signals */

/**
 * The one detector that reads two datasets at once. It reports that the same
 * theme appears in both employee and exit feedback — it does not claim that one
 * causes the other.
 */
/**
 * Pulse dimensions that have a genuine counterpart column in the exit survey.
 * Only these can produce a cross-source signal — nothing is inferred by name.
 */
const EXIT_COUNTERPARTS: Partial<
  Record<
    PulseScoreKey,
    {
      label: string
      reasonKeyword: string
      read: (exits: HrAnalytics['exits']) => MetricValue
    }
  >
> = {
  careerGrowth: {
    label: 'Exit career opportunity',
    reasonKeyword: 'career',
    read: (exits) => exits.averageCareerOpportunity,
  },
  managerSupport: {
    label: 'Exit manager support',
    reasonKeyword: 'manager',
    read: (exits) => exits.averageManagerSupport,
  },
}

function detectCrossSourceSignals({ analytics }: DetectionContext): HrInsight[] {
  const { pulse, exits } = analytics
  const latest = analytics.overview.latestPulse

  // Workload is excluded: its scale runs the other way, so "lowest" is not "weakest".
  const weakestPulse = sortAscending(
    PULSE_SCORE_META.filter((meta) => meta.key !== 'workload'),
    (meta) => latest[meta.key],
  )[0]
  if (!weakestPulse) return []

  const pulseScore = latest[weakestPulse.key]
  if (pulseScore === null || pulseScore > INSIGHT_THRESHOLDS.weakSurveyScore) return []

  const counterpart = EXIT_COUNTERPARTS[weakestPulse.key]
  if (!counterpart) return []

  const exitScore = counterpart.read(exits)
  if (exitScore === null || exitScore > INSIGHT_THRESHOLDS.weakSurveyScore) return []

  const matchingReason =
    exits.reasons.find((reason) => reason.reason.toLowerCase().includes(counterpart.reasonKeyword)) ??
    null

  // Two survey sources agree; a matching exit reason is a third supporting measure.
  const supportingMeasures = matchingReason ? 3 : 2

  return [
    {
      id: `career-cross-source-${slug(weakestPulse.label)}`,
      category: weakestPulse.category,
      title: `${weakestPulse.label} scores are weak across employee and exit feedback`,
      summary: `${weakestPulse.label} is the lowest latest pulse dimension at ${pulseScore.toFixed(2)}, and the matching exit survey measure also sits low at ${exitScore.toFixed(2)}.`,
      affectedScope: 'Company-wide feedback',
      scope: companyScope('Company-wide feedback'),
      isFavourable: false,
      /**
       * Severity uses the pulse shortfall only. Exit scores are systematically
       * lower — leavers rate their experience worse — so measuring an exit score
       * against a pulse-calibrated line would overstate severity. The
       * cross-source agreement is reflected in signal strength instead.
       */
      severity: {
        gap: Math.max(0, INSIGHT_THRESHOLDS.weakSurveyScore - pulseScore),
        kind: 'score',
      },
      signalStrength: supportingMeasures >= 3 ? 'strong' : 'moderate',
      direction: 'lower',
      metricLabel: weakestPulse.label,
      currentValue: pulseScore,
      referenceValue: exitScore,
      difference: gapOf(pulseScore, exitScore),
      sampleSize: pulse.responseCount + exits.responseCount,
      sampleLabel: 'pulse and exit responses',
      evidence: [
        scoreEvidence(
          `Pulse ${weakestPulse.label.toLowerCase()}`,
          pulseScore,
          `Lowest dimension in the latest pulse wave (${latest.wave ?? '—'}).`,
        ),
        scoreEvidence(
          counterpart.label,
          exitScore,
          'Matching measure recorded in the exit survey.',
        ),
        ...(matchingReason
          ? [
              {
                label: `Exit reason · ${matchingReason.reason}`,
                value: matchingReason.count,
                description: 'Exit responses citing a related primary reason.',
                format: 'count' as const,
              },
            ]
          : []),
        {
          label: 'Pulse responses',
          value: pulse.responseCount,
          description: 'Pulse responses across all waves.',
          format: 'count',
        },
        {
          label: 'Exit responses',
          value: exits.responseCount,
          description: 'Exit survey responses in the dataset.',
          format: 'count',
        },
      ],
      dataSources: ['Pulse Survey', 'Exit Survey'],
      detectionRule: `${weakestPulse.label} is at or below the configured weak-score line of ${INSIGHT_THRESHOLDS.weakSurveyScore.toFixed(2)} in the pulse survey (${pulseScore.toFixed(2)}) and in the exit survey (${exitScore.toFixed(2)}), so the same theme appears in both sources.`,
    },
  ]
}

/* ------------------------------------------------- dedupe, rank, limit */

/**
 * Everything detected about one group becomes one finding.
 *
 * The key is the affected scope alone, not scope-plus-category: "Sales
 * engagement is below average", "career growth is lower in Sales" and "Sales
 * has a higher leaver rate" are three measurements of one situation, and HR
 * should read them as a single card. The strongest signal supplies the title
 * and category; the others fold in as evidence and detection rules, so nothing
 * measured is lost and no group can crowd the list with near-duplicates.
 */
/** Joins two rule explanations without repeating a sentence. */
function mergeRules(first: string, second: string): string {
  const sentences = [first, second]
    .flatMap((rule) => rule.split(/(?<=\.)\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')
  return [...new Set(sentences)].join(' ')
}

function deduplicateInsights(insights: readonly HrInsight[]): HrInsight[] {
  const merged = new Map<string, HrInsight>()

  for (const insight of insights) {
    const key = insight.affectedScope
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, insight)
      continue
    }

    const insightWins =
      STRENGTH_ORDER[insight.signalStrength] < STRENGTH_ORDER[existing.signalStrength] ||
      (insight.signalStrength === existing.signalStrength &&
        Math.abs(insight.difference ?? 0) > Math.abs(existing.difference ?? 0))

    const keep = insightWins ? insight : existing
    const other = insightWins ? existing : insight
    const seen = new Set(keep.evidence.map((item) => item.label))

    merged.set(key, {
      ...keep,
      evidence: [...keep.evidence, ...other.evidence.filter((item) => !seen.has(item.label))],
      dataSources: [...new Set([...keep.dataSources, ...other.dataSources])],
      detectionRule: mergeRules(keep.detectionRule, other.detectionRule),
    })
  }

  return [...merged.values()]
}

/** Strength first, then the larger measured difference, then id for stability. */
function rankInsights(insights: readonly HrInsight[]): HrInsight[] {
  return [...insights].sort(
    (a, b) =>
      STRENGTH_ORDER[a.signalStrength] - STRENGTH_ORDER[b.signalStrength] ||
      Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0) ||
      a.id.localeCompare(b.id),
  )
}

export function summariseInsights(insights: readonly HrInsight[]): InsightSummary {
  const categoryCounts = [...new Set(insights.map((insight) => insight.category))]
    .map((category) => ({
      category,
      count: insights.filter((insight) => insight.category === category).length,
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))

  const sources = new Set<InsightDataSource>(insights.flatMap((insight) => insight.dataSources))

  return {
    totalSignals: insights.length,
    strongSignals: insights.filter((insight) => insight.signalStrength === 'strong').length,
    moderateSignals: insights.filter((insight) => insight.signalStrength === 'moderate').length,
    watchSignals: insights.filter((insight) => insight.signalStrength === 'watch').length,
    categoryCounts,
    dataSourceCount: sources.size,
    crossSourceSignals: insights.filter((insight) => insight.dataSources.length > 1).length,
  }
}

const DETECTORS = [
  detectCompanyPulseSignals,
  detectDivisionEngagementSignals,
  detectTenureBandSignals,
  detectNewJoinerSignals,
  detectOnboardingSignals,
  detectRetentionSignals,
  detectWorkplaceSignals,
  detectExitSignals,
  detectCrossSourceSignals,
] as const

export function generateHrInsights(analytics: HrAnalytics): HrInsightResult {
  const context: DetectionContext = { analytics, suppressed: [] }

  const detected = DETECTORS.flatMap((detect) => detect(context))
  const allInsights = rankInsights(deduplicateInsights(detected))
  const insights = allInsights.slice(0, MAX_VISIBLE_INSIGHTS)

  return {
    insights,
    allInsights,
    summary: summariseInsights(insights),
    suppressedForSampleSize: [...new Set(context.suppressed)].sort(),
  }
}

