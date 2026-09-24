import {
  ESTABLISHED_GROUP_LABEL,
  EXIT_METRICS,
  NEW_JOINER_GROUP_LABEL,
  NEW_JOINER_MAX_MONTHS,
  MIN_ANALYSIS_SAMPLE_SIZE,
  MEANINGFUL_SCORE_GAP,
  STRONG_SCORE_GAP,
  MEANINGFUL_EXIT_SHARE_GAP,
  STRONG_EXIT_SHARE_GAP,
  EVIDENCE_EQUALITY_TOLERANCE,
  ONBOARDING_DIMENSIONS,
  ONBOARDING_METRICS,
  PERCENTAGE_PRECISION,
  PULSE_SCORES,
  PULSE_STABLE_THRESHOLD,
  RATIO_PRECISION,
  SCORE_PRECISION,
  SCORE_SCALE,
  BASE_ENGAGEMENT_SCALE,
  TENURE_BANDS,
  TOP_EXIT_REASONS_LIMIT,
  TREND_TOLERANCE,
  WORKLOAD_DICTIONARY_LOOKUP,
  WORKLOAD_DIRECTION_PHRASES,
  getTenureBand,
  isNewJoiner,
  isValidBaseEngagement,
  isValidScore,
  type PulseScoreKey,
  type TenureBand,
} from '@/data/hr-analytics.constants'
import { ACTION_STATUSES, WOULD_RECOMMEND_VALUES, getEmployeeExitStatus } from '@/data/hr-data.constants'
import { validateHrDataset } from '@/services/hr-data-quality.service'
import { buildSuggestedPriorityIssues } from '@/services/hr-priority.service'
import type {
  ActionAnalytics,
  ActionScopeMetric,
  ActionThemeMetric,
  ChangeDirection,
  ChangeMetric,
  DivisionAnalytics,
  DivisionAnalysis,
  CommentThemeMention,
  DriverCandidate,
  EvidenceAnalysis,
  EvidenceItem,
  EvidenceSource,
  EvidenceStrength,
  EvidenceTheme,
  ExitReasonEvidence,
  ExitReasonCount,
  HrEvidenceAnalysis,
  DivisionEmployeeMetric,
  EmployeeAnalytics,
  EmployeeGroupAnalysis,
  EmployeeCountMetrics,
  EmployeeGroupMetric,
  ExitAnalytics,
  ExitCommentRecord,
  ExitDivisionMetric,
  ExitReasonMetric,
  ExitScores,
  GroupMetric,
  HrAnalytics,
  HrAnalysis,
  HrObservedPatterns,
  MetricValue,
  NewJoinerMetrics,
  OnboardingAnalytics,
  OnboardingDimensionMetric,
  OnboardingGroupMetric,
  OnboardingScores,
  OverviewAnalytics,
  PulseAnalytics,
  PulsePatternAnalysis,
  PulseComparison,
  PulseGroupTrend,
  PulseScores,
  PulseSegment,
  PulseTrendPoint,
  PulseWave,
  PulseWaveAnalysis,
  ScoreDirection,
  ScoreInterpretation,
  TenureBandEmployeeMetric,
  TrendPoint,
  WorkforceMetrics,
  WorkforceGroupAnalysis,
} from '@/types/hr-analytics'
import type {
  ActionRecord,
  DataDictionaryEntry,
  Employee,
  ExitSurvey,
  HrDataset,
  OnboardingSurvey,
  PulseSurvey,
} from '@/types/hr-data'
import {
  averageBy,
  average,
  countBy,
  countWhere,
  groupBy,
  minBy,
  percentage,
  roundOrNull,
  sortAscending,
  sortByText,
  sortDescending,
  subtract,
} from '@/utils/analytics'

/**
 * Deterministic HR analytics.
 *
 * Same dataset in, same numbers out — no randomness, no
 * network, no fallback values. Source arrays are treated as read-only.
 *
 * Invalid-value policy: a survey score outside the documented 1–5 scale (which
 * includes missing or invalid cells represented as `null`) is excluded from that
 * one average rather than counted as zero, and an average with nothing valid
 * left is `null`, never `0`. The exclusions are reported in `dataQuality`.
 */

/* ------------------------------------------------------------------ helpers */

const validScore = (value: number | null): number | null => (isValidScore(value) ? value : null)

const validRatio = (value: number | null): number | null => (isValidBaseEngagement(value) ? value : null)

const toNullableDate = (value: string): string | null => (value.trim() === '' ? null : value)

const nonEmpty = (value: string): string | null => {
  return value.trim() === '' ? null : value
}

const roundScore = (value: MetricValue): MetricValue => roundOrNull(value, SCORE_PRECISION)

const roundRate = (value: MetricValue): MetricValue => roundOrNull(value, PERCENTAGE_PRECISION)

const rate = (part: number, total: number): MetricValue => roundRate(percentage(part, total))

/** Builds the employee lookup once and reuses it for every survey join. */
export function buildEmployeeIndex(employees: readonly Employee[]): Map<string, Employee> {
  return new Map(employees.map((employee) => [employee.employeeId, employee]))
}

/* ---------------------------------------------------------------- employees */

function employeeCountMetrics(employees: readonly Employee[]): EmployeeCountMetrics {
  const leaverCount = countWhere(employees, (employee) => getEmployeeExitStatus(employee.exitStatus) === 'Leaver')

  return {
    employeeCount: employees.length,
    activeCount: countWhere(employees, (employee) => employee.exitStatus === 'Active'),
    leaverCount,
    leaverRate: rate(leaverCount, employees.length),
    averageBaseEngagement: roundOrNull(
      averageBy(employees, (employee) => validRatio(employee.baseEngagement)),
      RATIO_PRECISION,
    ),
  }
}

export function calculateWorkforceMetrics(employees: readonly Employee[]): WorkforceMetrics {
  const totals = employeeCountMetrics(employees)
  return {
    totalEmployees: totals.employeeCount,
    activeEmployees: totals.activeCount,
    leavers: totals.leaverCount,
    leaverRate: totals.leaverRate,
    averageBaseEngagement: totals.averageBaseEngagement,
  }
}

/** Survey dates determine order; equal or missing dates retain source order. */
export function comparePulseWaveChronology(
  a: Pick<PulseWaveAnalysis, 'date' | 'wave'>,
  b: Pick<PulseWaveAnalysis, 'date' | 'wave'>,
): number {
  if (a.date === null && b.date !== null) return -1
  if (a.date !== null && b.date === null) return 1
  return (a.date ?? '').localeCompare(b.date ?? '')
}

export function getPulseTrendDirection(
  change: number | null,
): PulsePatternAnalysis['trendDirection'] {
  if (change === null) return null
  if (change > PULSE_STABLE_THRESHOLD) return 'up'
  if (change < -PULSE_STABLE_THRESHOLD) return 'down'
  return 'stable'
}

function buildPulsePatternAnalysis(rows: readonly PulseSurvey[]): PulsePatternAnalysis {
  const waves = [...groupBy(rows, (row) => nonEmpty(row.surveyWave))]
    .map(([wave, waveRows]): PulseWaveAnalysis => {
      const validResponses = waveRows.filter((row) => isValidScore(row.engagementScore))
      const date = waveRows
        .map((row) => row.surveyDate)
        .filter((value) => value !== '')
        .sort((a, b) => a.localeCompare(b))
        .at(-1) ?? null

      return {
        wave,
        date,
        responseCount: validResponses.length,
        uniqueRespondentCount: new Set(
          validResponses.map((row) => row.employeeId).filter((id) => id.trim() !== ''),
        ).size,
        averageEngagement: averageBy(validResponses, (row) => row.engagementScore),
        participationRate: null,
      }
    })
    .sort(comparePulseWaveChronology)

  const comparable = waves.filter((wave) => wave.averageEngagement !== null)
  const latestWave = comparable.at(-1) ?? null
  const previousWave = comparable.at(-2) ?? null
  const latestChange =
    latestWave?.averageEngagement != null && previousWave?.averageEngagement != null
      ? latestWave.averageEngagement - previousWave.averageEngagement
      : null

  return {
    waves,
    latestWave,
    previousWave,
    latestChange,
    trendDirection: getPulseTrendDirection(latestChange),
  }
}

function buildWorkforceGroupAnalysis(
  employees: readonly Employee[],
  latestPulseRows: readonly PulseSurvey[],
  employeeIndex: Map<string, Employee>,
  getKey: (employee: Employee) => string,
  companyPulseEngagement: MetricValue,
  companyLeaverRate: MetricValue,
): (WorkforceGroupAnalysis & { group: string })[] {
  const groupedEmployees = groupBy(employees, (employee) => nonEmpty(getKey(employee)))
  const groupedResponses = groupBy(latestPulseRows, (row) => {
    const employee = employeeIndex.get(row.employeeId)
    return employee ? nonEmpty(getKey(employee)) : null
  })

  return [...groupedEmployees].map(([group, groupEmployees]) => {
    const responses = groupedResponses.get(group) ?? []
    const counts = employeeCountMetrics(groupEmployees)
    const latestPulseEngagement = averageBy(responses, (row) => row.engagementScore)
    const difference =
      latestPulseEngagement !== null && companyPulseEngagement !== null
        ? latestPulseEngagement - companyPulseEngagement
        : null

    return {
      group,
      ...counts,
      latestPulseEngagement,
      latestPulseResponseCount: responses.length,
      engagementDifferenceFromCompany: difference,
      isSmallSample: responses.length < MIN_ANALYSIS_SAMPLE_SIZE,
      belowCompanyAverage: difference !== null && difference < 0,
      aboveCompanyLeaverRate:
        counts.leaverRate !== null &&
        companyLeaverRate !== null &&
        counts.leaverRate > companyLeaverRate,
    }
  })
}

function buildObservedPatterns(
  divisions: readonly DivisionAnalysis[],
  employeeGroups: readonly EmployeeGroupAnalysis[],
  pulse: PulsePatternAnalysis,
): HrObservedPatterns {
  const lowestEngagementDivision =
    sortAscending(divisions, (entry) => entry.latestPulseEngagement)
      .find((entry) => entry.latestPulseEngagement !== null) ?? null
  const highestLeaverRateDivision =
    sortDescending(divisions, (entry) => entry.leaverRate)
      .find((entry) => entry.leaverRate !== null) ?? null
  const lowestEngagementEmployeeGroup =
    sortAscending(employeeGroups, (entry) => entry.latestPulseEngagement)
      .find((entry) => entry.latestPulseEngagement !== null) ?? null
  const comparableWaves = pulse.waves.filter((wave) => wave.averageEngagement !== null)
  const changes = comparableWaves.flatMap((wave, index) => {
    const previous = comparableWaves[index - 1]
    if (wave.averageEngagement === null || previous?.averageEngagement == null) return []
    const change = wave.averageEngagement - previous.averageEngagement
    return change < 0 ? [{ fromWave: previous.wave, toWave: wave.wave, change }] : []
  })
  const largestNegativePulseChange =
    sortAscending(changes, (entry) => entry.change)[0] ?? null

  const signals: HrObservedPatterns['signals'] = []
  if (lowestEngagementDivision?.latestPulseEngagement != null && pulse.latestWave?.averageEngagement != null) {
    signals.push({
      id: 'division-engagement',
      message: `${lowestEngagementDivision.division} recorded ${lowestEngagementDivision.latestPulseEngagement.toFixed(2)} / 5 in the latest pulse, compared with ${pulse.latestWave.averageEngagement.toFixed(2)} / 5 company-wide (n = ${lowestEngagementDivision.latestPulseResponseCount}${lowestEngagementDivision.isSmallSample ? ', small sample' : ''}).`,
    })
  }
  if (lowestEngagementEmployeeGroup?.latestPulseEngagement != null && pulse.latestWave?.averageEngagement != null) {
    signals.push({
      id: 'employee-group-engagement',
      message: `${lowestEngagementEmployeeGroup.group} recorded ${lowestEngagementEmployeeGroup.latestPulseEngagement.toFixed(2)} / 5 in the latest pulse, compared with ${pulse.latestWave.averageEngagement.toFixed(2)} / 5 company-wide (n = ${lowestEngagementEmployeeGroup.latestPulseResponseCount}${lowestEngagementEmployeeGroup.isSmallSample ? ', small sample' : ''}).`,
    })
  }
  if (pulse.latestChange !== null && pulse.latestWave && pulse.previousWave) {
    signals.push({
      id: 'pulse-change',
      message: `Company pulse engagement changed by ${pulse.latestChange > 0 ? '+' : ''}${pulse.latestChange.toFixed(2)} points from ${pulse.previousWave.wave} to ${pulse.latestWave.wave} (n = ${pulse.latestWave.responseCount} in the latest wave).`,
    })
  }
  if (highestLeaverRateDivision?.leaverRate != null) {
    signals.push({
      id: 'division-leavers',
      message: `${highestLeaverRateDivision.division} recorded the highest division leaver rate at ${highestLeaverRateDivision.leaverRate.toFixed(2)}% (${highestLeaverRateDivision.leaverCount} of ${highestLeaverRateDivision.employeeCount} employees).`,
    })
  }

  return {
    lowestEngagementDivision,
    highestLeaverRateDivision,
    lowestEngagementEmployeeGroup,
    largestNegativePulseChange,
    pulseDeclining: pulse.trendDirection === 'down',
    signals,
  }
}

function employeeBreakdown(
  employees: readonly Employee[],
  getGroup: (employee: Employee) => string | null,
): EmployeeGroupMetric[] {
  const grouped = [...groupBy(employees, getGroup)].map(([group, rows]) => ({
    group,
    ...employeeCountMetrics(rows),
  }))
  return sortByText(grouped, (entry) => entry.group)
}

function newJoinerMetrics(employees: readonly Employee[]): NewJoinerMetrics {
  const newJoiners = employees.filter((employee) => isNewJoiner(employee.tenureMonths))
  const metrics = employeeCountMetrics(newJoiners)
  return {
    maxTenureMonths: NEW_JOINER_MAX_MONTHS,
    newJoinerCount: metrics.employeeCount,
    newJoinerActiveCount: metrics.activeCount,
    newJoinerLeaverCount: metrics.leaverCount,
    newJoinerLeaverRate: metrics.leaverRate,
    newJoinerAverageBaseEngagement: metrics.averageBaseEngagement,
  }
}

function calculateEmployeeAnalytics(
  employees: readonly Employee[],
  workforce: WorkforceMetrics,
): EmployeeAnalytics {

  const byDivision: DivisionEmployeeMetric[] = employeeBreakdown(employees, (employee) =>
    nonEmpty(employee.division),
  ).map(({ group, ...counts }) => ({ division: group, ...counts }))

  const byTenureBand: TenureBandEmployeeMetric[] = TENURE_BANDS.map((band) => ({
    band,
    ...employeeCountMetrics(
      employees.filter((employee) => getTenureBand(employee.tenureMonths) === band),
    ),
  }))

  return {
    ...workforce,
    activeRate: rate(workforce.activeEmployees, workforce.totalEmployees),
    byDivision,
    byEmployeeGroup: employeeBreakdown(employees, (employee) => nonEmpty(employee.employeeGroup)),
    byLocation: employeeBreakdown(employees, (employee) => nonEmpty(employee.location)),
    byTenureBand,
    newJoiners: newJoinerMetrics(employees),
    highestLeaverRateDivision: sortDescending(byDivision, (entry) => entry.leaverRate)[0] ?? null,
  }
}

/* --------------------------------------------------------------- onboarding */

function onboardingScores(rows: readonly OnboardingSurvey[]): OnboardingScores {
  return {
    averageOverallScore: roundScore(averageBy(rows, (row) => validScore(row.overallScore))),
    averageManagerSupport: roundScore(averageBy(rows, (row) => validScore(row.managerSupport))),
    averageRoleClarity: roundScore(averageBy(rows, (row) => validScore(row.roleClarity))),
    averageToolsAccess: roundScore(averageBy(rows, (row) => validScore(row.toolsAccess))),
  }
}

const onboardingGroup = (group: string, rows: readonly OnboardingSurvey[]): OnboardingGroupMetric => ({
  group,
  responseCount: rows.length,
  ...onboardingScores(rows),
})

function onboardingBreakdown(
  rows: readonly OnboardingSurvey[],
  getGroup: (row: OnboardingSurvey) => string | null,
): OnboardingGroupMetric[] {
  const grouped = [...groupBy(rows, getGroup)].map(([group, groupRows]) =>
    onboardingGroup(group, groupRows),
  )
  return sortByText(grouped, (entry) => entry.group)
}

function calculateOnboardingAnalytics(
  rows: readonly OnboardingSurvey[],
  employeeIndex: Map<string, Employee>,
): OnboardingAnalytics {
  const scores = onboardingScores(rows)

  const dimensions: OnboardingDimensionMetric[] = ONBOARDING_DIMENSIONS.map(
    ({ key, label, scoreField }) => ({ key, label, score: scores[scoreField] }),
  )

  /**
   * The employee record is the authority for division and group; the survey's
   * own copy of those columns is the fallback when the join finds nothing.
   */
  const divisionOf = (row: OnboardingSurvey): string | null =>
    nonEmpty(employeeIndex.get(row.employeeId)?.division ?? row.division)

  const employeeGroupOf = (row: OnboardingSurvey): string | null =>
    nonEmpty(employeeIndex.get(row.employeeId)?.employeeGroup ?? row.employeeGroup)

  const newJoinerRows = rows.filter((row) => {
    const employee = employeeIndex.get(row.employeeId)
    return employee ? isNewJoiner(employee.tenureMonths) : false
  })

  return {
    responseCount: rows.length,
    ...scores,
    metrics: ONBOARDING_METRICS.map(({ key, label }) => ({ key, label, value: scores[key] })),
    dimensions: sortAscending(dimensions, (entry) => entry.score),
    weakestDimension: minBy(dimensions, (entry) => entry.score),
    byDivision: onboardingBreakdown(rows, divisionOf),
    byEmployeeGroup: onboardingBreakdown(rows, employeeGroupOf),
    newJoiners:
      newJoinerRows.length > 0 ? onboardingGroup(NEW_JOINER_GROUP_LABEL, newJoinerRows) : null,
  }
}

/* -------------------------------------------------------------------- pulse */

/** Raw (unrounded) averages, so wave-over-wave change is computed at full precision. */
function rawPulseScores(rows: readonly PulseSurvey[]): PulseScores {
  return {
    engagement: averageBy(rows, (row) => validScore(row.engagementScore)),
    managerSupport: averageBy(rows, (row) => validScore(row.managerSupport)),
    workload: averageBy(rows, (row) => validScore(row.workload)),
    careerGrowth: averageBy(rows, (row) => validScore(row.careerGrowth)),
    belonging: averageBy(rows, (row) => validScore(row.belonging)),
  }
}

/** Maps every score with one function — keeps the five keys in a single place. */
function mapPulseScores(
  scores: PulseScores,
  transform: (value: MetricValue, key: PulseScoreKey) => MetricValue,
): PulseScores {
  return PULSE_SCORES.reduce<PulseScores>(
    (result, { key }) => ({ ...result, [key]: transform(scores[key], key) }),
    { ...scores },
  )
}

const roundPulseScores = (scores: PulseScores): PulseScores =>
  mapPulseScores(scores, (value) => roundScore(value))

interface WaveAggregate {
  wave: string
  date: string | null
  responseCount: number
  raw: PulseScores
}

function earliestDate(dates: readonly string[]): string | null {
  const valid = dates.map(toNullableDate).filter((date): date is string => date !== null)
  return valid.length === 0 ? null : [...valid].sort()[0]
}

/**
 * Waves are discovered from the data, never assumed, and ordered by their
 * earliest `surveyDate`. Waves without a usable date fall back to label order.
 */
function aggregateWaves(rows: readonly PulseSurvey[]): WaveAggregate[] {
  const grouped = [...groupBy(rows, (row) => nonEmpty(row.surveyWave))].map(
    ([wave, waveRows]) => ({
      wave,
      date: earliestDate(waveRows.map((row) => row.surveyDate)),
      responseCount: waveRows.length,
      raw: rawPulseScores(waveRows),
    }),
  )

  return grouped.sort((a, b) => {
    if (a.date !== null && b.date !== null && a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.date === null && b.date !== null) return 1
    if (a.date !== null && b.date === null) return -1
    return a.wave.localeCompare(b.wave)
  })
}

const toTrendPoint = (aggregate: WaveAggregate): PulseTrendPoint => ({
  wave: aggregate.wave,
  date: aggregate.date,
  responseCount: aggregate.responseCount,
  ...roundPulseScores(aggregate.raw),
})

function direction(change: MetricValue): ChangeDirection {
  if (change === null || Math.abs(change) < TREND_TOLERANCE) return 'flat'
  return change > 0 ? 'up' : 'down'
}

/** Change between the earliest and the latest wave. `null` below two waves. */
function engagementChange(waves: readonly WaveAggregate[]): ChangeMetric | null {
  const first = waves[0]
  const last = waves[waves.length - 1]
  if (!first || !last || first === last) return null

  const from = first.raw.engagement
  const to = last.raw.engagement
  const absoluteChange = subtract(to, from)

  return {
    fromLabel: first.wave,
    toLabel: last.wave,
    from: roundScore(from),
    to: roundScore(to),
    absoluteChange: roundOrNull(absoluteChange, RATIO_PRECISION),
    percentageChange:
      absoluteChange === null || from === null || from === 0
        ? null
        : roundRate((absoluteChange / from) * 100),
    direction: direction(absoluteChange),
  }
}

/**
 * Trend per group, always covering the full company wave list so a chart can
 * align series. A wave a group did not answer is `0` responses and `null`
 * scores — an absence, not a zero score.
 */
function pulseBreakdown(
  rows: readonly PulseSurvey[],
  waveOrder: readonly WaveAggregate[],
  getGroup: (row: PulseSurvey) => string | null,
  groupOrder?: readonly string[],
): PulseGroupTrend[] {
  const grouped = groupBy(rows, getGroup)
  const keys = groupOrder ?? [...grouped.keys()].sort((a, b) => a.localeCompare(b))

  return keys.map((group) => {
    const groupRows = grouped.get(group) ?? []
    const byWave = groupBy(groupRows, (row) => nonEmpty(row.surveyWave))

    const trend = waveOrder.map(({ wave, date }) => {
      const waveRows = byWave.get(wave) ?? []
      return {
        wave,
        date,
        responseCount: waveRows.length,
        ...roundPulseScores(rawPulseScores(waveRows)),
      }
    })

    return {
      group,
      responseCount: groupRows.length,
      averages: roundPulseScores(rawPulseScores(groupRows)),
      trend,
      latest: [...trend].reverse().find((point) => point.responseCount > 0) ?? null,
    }
  })
}

const pulseSegment = (group: string, rows: readonly PulseSurvey[]): PulseSegment => ({
  group,
  responseCount: rows.length,
  averages: roundPulseScores(rawPulseScores(rows)),
})

/** New joiner vs everyone else. Returns the difference; attaches no judgement. */
function newJoinerComparison(
  rows: readonly PulseSurvey[],
  employeeIndex: Map<string, Employee>,
): PulseComparison | null {
  const newJoinerRows: PulseSurvey[] = []
  const otherRows: PulseSurvey[] = []

  for (const row of rows) {
    const employee = employeeIndex.get(row.employeeId)
    if (!employee) continue
    if (isNewJoiner(employee.tenureMonths)) newJoinerRows.push(row)
    else otherRows.push(row)
  }

  if (newJoinerRows.length === 0 || otherRows.length === 0) return null

  const newJoiners = pulseSegment(NEW_JOINER_GROUP_LABEL, newJoinerRows)
  const others = pulseSegment(ESTABLISHED_GROUP_LABEL, otherRows)

  return {
    newJoiners,
    others,
    difference: mapPulseScores(newJoiners.averages, (value, key) =>
      roundOrNull(subtract(value, others.averages[key]), RATIO_PRECISION),
    ),
  }
}

/**
 * Reads the workload scale direction out of `Data_Dictionary` instead of
 * assuming it. The score itself is never reversed anywhere in this layer.
 */
function workloadInterpretation(dictionary: readonly DataDictionaryEntry[]): ScoreInterpretation {
  const entry = dictionary.find(
    (item) =>
      item.table.toLowerCase().includes(WORKLOAD_DICTIONARY_LOOKUP.table) &&
      item.field.toLowerCase() === WORKLOAD_DICTIONARY_LOOKUP.field,
  )

  const description = entry ? nonEmpty(entry.description) : null
  const haystack = description?.toLowerCase() ?? ''
  const match = WORKLOAD_DIRECTION_PHRASES.find((option) =>
    option.phrases.some((phrase) => haystack.includes(phrase)),
  )

  const resolved: ScoreDirection = match ? match.direction : 'unknown'

  return {
    key: 'workload',
    label: 'Workload',
    direction: resolved,
    source: match ? 'dataDictionary' : 'undocumented',
    description,
  }
}

function calculatePulseAnalytics(
  rows: readonly PulseSurvey[],
  employeeIndex: Map<string, Employee>,
  dictionary: readonly DataDictionaryEntry[],
): PulseAnalytics {
  const waveAggregates = [...aggregateWaves(rows)].sort(comparePulseWaveChronology)
  const trend = waveAggregates.map(toTrendPoint)
  const averages = roundPulseScores(rawPulseScores(rows))

  const waves: PulseWave[] = waveAggregates.map(({ wave, date, responseCount }) => ({
    wave,
    date,
    responseCount,
  }))

  const engagementTrend: TrendPoint[] = trend.map((point) => ({
    label: point.wave,
    date: point.date,
    value: point.engagement,
    responseCount: point.responseCount,
  }))

  const divisionOf = (row: PulseSurvey): string | null =>
    nonEmpty(employeeIndex.get(row.employeeId)?.division ?? '')

  const employeeGroupOf = (row: PulseSurvey): string | null =>
    nonEmpty(employeeIndex.get(row.employeeId)?.employeeGroup ?? '')

  const tenureBandOf = (row: PulseSurvey): TenureBand | null => {
    const employee = employeeIndex.get(row.employeeId)
    return employee ? getTenureBand(employee.tenureMonths) : null
  }

  return {
    responseCount: rows.length,
    averages,
    metrics: PULSE_SCORES.map(({ key, label }) => ({ key, label, value: averages[key] })),
    waves,
    trend,
    engagementChange: engagementChange(waveAggregates),
    engagementTrend,
    byDivision: pulseBreakdown(rows, waveAggregates, divisionOf),
    byEmployeeGroup: pulseBreakdown(rows, waveAggregates, employeeGroupOf),
    byTenureBand: pulseBreakdown(rows, waveAggregates, tenureBandOf, TENURE_BANDS),
    newJoinerComparison: newJoinerComparison(rows, employeeIndex),
    workload: workloadInterpretation(dictionary),
  }
}

/* -------------------------------------------------------------------- exits */

function exitScores(rows: readonly ExitSurvey[]): ExitScores {
  return {
    averageOverallExperience: roundScore(
      averageBy(rows, (row) => validScore(row.overallExperience)),
    ),
    averageManagerSupport: roundScore(averageBy(rows, (row) => validScore(row.managerSupport))),
    averageCareerOpportunity: roundScore(
      averageBy(rows, (row) => validScore(row.careerOpportunity)),
    ),
    averageWorkload: roundScore(averageBy(rows, (row) => validScore(row.workload))),
  }
}

/** Source reason strings are kept verbatim — nothing renamed, nothing merged. */
function exitReasons(rows: readonly ExitSurvey[]): ExitReasonMetric[] {
  const counts = [...countBy(rows, (row) => nonEmpty(row.primaryExitReason))].map(
    ([reason, count]) => ({ reason, count, percentage: rate(count, rows.length) }),
  )
  return sortDescending(counts, (entry) => entry.count)
}

function calculateExitAnalytics(
  rows: readonly ExitSurvey[],
  employeeIndex: Map<string, Employee>,
): ExitAnalytics {
  const scores = exitScores(rows)
  const reasons = exitReasons(rows)

  const wouldRecommend: GroupMetric[] = WOULD_RECOMMEND_VALUES.map((value) => {
    const count = countWhere(rows, (row) => row.wouldRecommend === value)
    return { group: value, count, percentage: rate(count, rows.length) }
  })

  const byDivision: ExitDivisionMetric[] = sortByText(
    [...groupBy(rows, (row) => nonEmpty(employeeIndex.get(row.employeeId)?.division ?? ''))].map(
      ([division, divisionRows]) => ({
        division,
        exitResponseCount: divisionRows.length,
        topExitReasons: exitReasons(divisionRows).slice(0, TOP_EXIT_REASONS_LIMIT),
        ...exitScores(divisionRows),
      }),
    ),
    (entry) => entry.division,
  )

  const comments: ExitCommentRecord[] = rows
    .filter((row) => nonEmpty(row.comment) !== null)
    .map((row) => ({
      employeeId: row.employeeId,
      division: nonEmpty(employeeIndex.get(row.employeeId)?.division ?? ''),
      primaryExitReason: row.primaryExitReason,
      comment: row.comment,
    }))

  return {
    responseCount: rows.length,
    ...scores,
    metrics: EXIT_METRICS.map(({ key, label }) => ({ key, label, value: scores[key] })),
    wouldRecommend,
    reasons,
    topExitReasons: reasons.slice(0, TOP_EXIT_REASONS_LIMIT),
    byDivision,
    comments: {
      commentCount: rows.length,
      nonEmptyCommentCount: comments.length,
      comments,
    },
  }
}

/* ------------------------------------------------------------------ actions */

/**
 * Deterministic reading order: still-open work first, then the most recently
 * started, then by id so equal rows never swap between renders.
 */
function orderActionRecords(actions: readonly ActionRecord[]): ActionRecord[] {
  const openFirst = (action: ActionRecord) => (action.status === 'Completed' ? 1 : 0)

  return [...actions].sort(
    (a, b) =>
      openFirst(a) - openFirst(b) ||
      b.startDate.localeCompare(a.startDate) ||
      a.actionId.localeCompare(b.actionId),
  )
}

function calculateActionAnalytics(actions: readonly ActionRecord[]): ActionAnalytics {
  const countStatus = (status: ActionRecord['status']) =>
    countWhere(actions, (action) => action.status === status)

  const completedActions = countStatus('Completed')

  const byStatus: GroupMetric[] = ACTION_STATUSES.map((status) => {
    const count = countStatus(status)
    return { group: status, count, percentage: rate(count, actions.length) }
  })

  const byScope: ActionScopeMetric[] = sortByText(
    [...groupBy(actions, (action) => nonEmpty(action.scope))].map(([scope, rows]) => {
      const completed = countWhere(rows, (action) => action.status === 'Completed')
      return { scope, count: rows.length, completed, open: rows.length - completed }
    }),
    (entry) => entry.scope,
  )

  const byTheme: ActionThemeMetric[] = sortByText(
    [...groupBy(actions, (action) => nonEmpty(action.theme))].map(([theme, rows]) => ({
      theme,
      count: rows.length,
      statusBreakdown: ACTION_STATUSES.map((status) => {
        const count = countWhere(rows, (action) => action.status === status)
        return { group: status, count, percentage: rate(count, rows.length) }
      }),
    })),
    (entry) => entry.theme,
  )

  return {
    totalActions: actions.length,
    plannedActions: countStatus('Planned'),
    inProgressActions: countStatus('In Progress'),
    completedActions,
    openActions: actions.length - completedActions,
    completionRate: rate(completedActions, actions.length),
    byStatus,
    byScope,
    byTheme,
    records: orderActionRecords(actions),
  }
}

/* ---------------------------------------------------------------- divisions */

function buildDivisionRollup(
  employees: EmployeeAnalytics,
  onboarding: OnboardingAnalytics,
  pulse: PulseAnalytics,
  exits: ExitAnalytics,
): DivisionAnalytics[] {
  const onboardingByGroup = new Map(onboarding.byDivision.map((entry) => [entry.group, entry]))
  const pulseByGroup = new Map(pulse.byDivision.map((entry) => [entry.group, entry]))
  const exitsByDivision = new Map(exits.byDivision.map((entry) => [entry.division, entry]))

  return employees.byDivision.map((entry) => ({
    division: entry.division,
    employees: entry,
    onboarding: onboardingByGroup.get(entry.division) ?? null,
    pulse: pulseByGroup.get(entry.division) ?? null,
    exits: exitsByDivision.get(entry.division) ?? null,
  }))
}

/* ----------------------------------------------------------------- overview */

function buildOverview(
  employees: EmployeeAnalytics,
  onboarding: OnboardingAnalytics,
  pulse: PulseAnalytics,
  exits: ExitAnalytics,
  actions: ActionAnalytics,
): OverviewAnalytics {
  const latest = pulse.trend[pulse.trend.length - 1] ?? null

  return {
    totalEmployees: employees.totalEmployees,
    activeEmployees: employees.activeEmployees,
    leavers: employees.leavers,
    leaverRate: employees.leaverRate,
    averageBaseEngagement: employees.averageBaseEngagement,
    newJoinerCount: employees.newJoiners.newJoinerCount,
    newJoinerLeaverRate: employees.newJoiners.newJoinerLeaverRate,
    onboarding: {
      responseCount: onboarding.responseCount,
      averageScore: onboarding.averageOverallScore,
      managerSupport: onboarding.averageManagerSupport,
      roleClarity: onboarding.averageRoleClarity,
      toolsAccess: onboarding.averageToolsAccess,
    },
    latestPulse: {
      wave: latest?.wave ?? null,
      date: latest?.date ?? null,
      responseCount: latest?.responseCount ?? 0,
      engagement: latest?.engagement ?? null,
      managerSupport: latest?.managerSupport ?? null,
      workload: latest?.workload ?? null,
      careerGrowth: latest?.careerGrowth ?? null,
      belonging: latest?.belonging ?? null,
    },
    exitResponseCount: exits.responseCount,
    totalActions: actions.totalActions,
    openActions: actions.openActions,
  }
}

/* --------------------------------------------------------------------- root */

type DimensionSpec<T> = {
  metric: string
  label: string
  theme: EvidenceTheme
  better: 'higher' | 'lower' | 'unknown'
  read: (row: T) => number | null
}

type DimensionStats = { value: MetricValue; sampleSize: number }

const PULSE_EVIDENCE_DIMENSIONS: readonly DimensionSpec<PulseSurvey>[] = [
  { metric: 'engagementScore', label: 'Engagement', theme: 'engagement', better: 'higher', read: (row) => row.engagementScore },
  { metric: 'managerSupport', label: 'Manager Support', theme: 'managerSupport', better: 'higher', read: (row) => row.managerSupport },
  { metric: 'workload', label: 'Workload Pressure', theme: 'workload', better: 'lower', read: (row) => row.workload },
  { metric: 'careerGrowth', label: 'Career Growth', theme: 'careerGrowth', better: 'higher', read: (row) => row.careerGrowth },
  { metric: 'belonging', label: 'Belonging', theme: 'belonging', better: 'higher', read: (row) => row.belonging },
]

const ONBOARDING_EVIDENCE_DIMENSIONS: readonly DimensionSpec<OnboardingSurvey>[] = [
  { metric: 'overallScore', label: 'Overall Onboarding', theme: 'onboardingOverall', better: 'higher', read: (row) => row.overallScore },
  { metric: 'managerSupport', label: 'Manager Support', theme: 'managerSupport', better: 'higher', read: (row) => row.managerSupport },
  { metric: 'roleClarity', label: 'Role Clarity', theme: 'roleClarity', better: 'higher', read: (row) => row.roleClarity },
  { metric: 'toolsAccess', label: 'Tools Access', theme: 'toolsAccess', better: 'higher', read: (row) => row.toolsAccess },
]

const EXIT_EVIDENCE_DIMENSIONS: readonly DimensionSpec<ExitSurvey>[] = [
  { metric: 'overallExperience', label: 'Overall Exit Experience', theme: 'exitOverall', better: 'higher', read: (row) => row.overallExperience },
  { metric: 'managerSupport', label: 'Manager Support', theme: 'managerSupport', better: 'higher', read: (row) => row.managerSupport },
  { metric: 'careerOpportunity', label: 'Career Opportunity', theme: 'careerGrowth', better: 'higher', read: (row) => row.careerOpportunity },
  { metric: 'workload', label: 'Exit Workload Rating', theme: 'exitWorkload', better: 'unknown', read: (row) => row.workload },
]

/** Only direct field matches or closely corresponding survey concepts share a theme. */
const DRIVER_THEME_LABELS: Partial<Record<EvidenceTheme, string>> = {
  managerSupport: 'Manager Support',
  careerGrowth: 'Career Growth / Opportunity',
  belonging: 'Belonging',
  workload: 'Workload Pressure',
  roleClarity: 'Role Clarity',
  toolsAccess: 'Tools Access',
}

const COMMENT_THEME_KEYWORDS: readonly {
  theme: EvidenceTheme
  label: string
  keywords: readonly string[]
}[] = [
  { theme: 'managerSupport', label: 'Manager Support', keywords: ['manager', 'supervisor'] },
  { theme: 'careerGrowth', label: 'Career Growth', keywords: ['career', 'promotion', 'progression', 'growth'] },
  { theme: 'toolsAccess', label: 'Tools Access', keywords: ['access', 'tool', 'tools', 'login', 'system'] },
  { theme: 'roleClarity', label: 'Role Clarity', keywords: ['role clarity', 'unclear role', 'responsibilities'] },
  { theme: 'workload', label: 'Workload', keywords: ['workload', 'overload', 'overtime'] },
  { theme: 'belonging', label: 'Belonging', keywords: ['belonging', 'team fit'] },
]

/** Structured exit reasons are mapped conservatively; unrecognised reasons remain ungrouped. */
const EXIT_REASON_THEME_KEYWORDS: readonly {
  theme: EvidenceTheme
  keywords: readonly string[]
}[] = [
  { theme: 'careerGrowth', keywords: ['career', 'promotion', 'growth', 'opportunity'] },
  { theme: 'managerSupport', keywords: ['manager', 'supervisor'] },
  { theme: 'workload', keywords: ['workload', 'overtime'] },
]

const normaliseForMatching = (value: string): string =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const containsKeyword = (normalisedText: string, keyword: string): boolean =>
  ` ${normalisedText} `.includes(` ${keyword} `)

function dimensionStats<T>(rows: readonly T[], spec: DimensionSpec<T>): DimensionStats {
  const valid = rows.map(spec.read).filter(isValidScore)
  return { value: average(valid), sampleSize: valid.length }
}

function companyDimensionStats<T>(
  rows: readonly T[],
  specs: readonly DimensionSpec<T>[],
): Map<string, DimensionStats> {
  return new Map(specs.map((spec) => [spec.metric, dimensionStats(rows, spec)]))
}

function classifyItemStrength(
  difference: MetricValue,
  unit: EvidenceItem['unit'],
  sampleSize: number,
  companySampleSize: number,
  supportsPattern: boolean,
): EvidenceStrength {
  if (!supportsPattern || difference === null ||
      sampleSize < MIN_ANALYSIS_SAMPLE_SIZE || companySampleSize < MIN_ANALYSIS_SAMPLE_SIZE) {
    return 'limited'
  }
  const meaningful = unit === 'score'
    ? Math.abs(difference) >= MEANINGFUL_SCORE_GAP
    : difference >= MEANINGFUL_EXIT_SHARE_GAP
  return meaningful ? 'moderate' : 'limited'
}

function scoreEvidenceItems<T>(
  source: EvidenceSource,
  groupRows: readonly T[],
  specs: readonly DimensionSpec<T>[],
  companyStats: Map<string, DimensionStats>,
): EvidenceItem[] {
  return specs.map((spec): EvidenceItem => {
    const group = dimensionStats(groupRows, spec)
    const company = companyStats.get(spec.metric) ?? { value: null, sampleSize: 0 }
    const difference =
      group.value !== null && company.value !== null ? group.value - company.value : null
    const direction =
      difference === null
        ? 'not_comparable'
        : Math.abs(difference) < EVIDENCE_EQUALITY_TOLERANCE
          ? 'same'
          : difference < 0 ? 'lower' : 'higher'
    const isSmallSample = group.sampleSize < MIN_ANALYSIS_SAMPLE_SIZE
    const supportsPattern =
      difference !== null &&
      (spec.better === 'higher' && difference < -EVIDENCE_EQUALITY_TOLERANCE ||
        spec.better === 'lower' && difference > EVIDENCE_EQUALITY_TOLERANCE) &&
      spec.theme !== 'engagement' && spec.theme !== 'onboardingOverall' &&
      spec.theme !== 'exitOverall'
    const strength = classifyItemStrength(
      difference, 'score', group.sampleSize, company.sampleSize, supportsPattern,
    )

    const note = difference === null
      ? `${spec.label} has no comparable ${source} score for this group.`
      : `${spec.label} is ${Math.abs(difference).toFixed(2)} points ${direction} than the company ${source} average (n = ${group.sampleSize}; company n = ${company.sampleSize})${isSmallSample ? '; small sample' : ''}.`

    return {
      id: `${source}:${spec.metric}`,
      source,
      theme: spec.theme,
      metric: spec.metric,
      label: spec.label,
      unit: 'score',
      groupValue: group.value,
      companyValue: company.value,
      difference,
      sampleSize: group.sampleSize,
      companySampleSize: company.sampleSize,
      direction,
      strength,
      isSmallSample,
      supportsPattern,
      note,
    }
  })
}

function exitReasonEvidence(
  groupRows: readonly ExitSurvey[],
  companyRows: readonly ExitSurvey[],
  companyCounts: Map<string, number>,
): ExitReasonEvidence[] {
  const validGroup = groupRows.filter((row) => nonEmpty(row.primaryExitReason) !== null)
  const groupCounts = countBy(validGroup, (row) => nonEmpty(row.primaryExitReason))

  return sortDescending(
    [...groupCounts].map(([reason, count]) => {
      const share = percentage(count, validGroup.length)
      const companyCount = companyCounts.get(reason) ?? 0
      const companyShare = percentage(companyCount, companyRows.length)
      const normalisedReason = normaliseForMatching(reason)
      const theme = EXIT_REASON_THEME_KEYWORDS.find((entry) =>
        entry.keywords.some((keyword) => containsKeyword(normalisedReason, keyword)),
      )?.theme ?? null

      return {
        reason,
        count,
        share,
        sampleSize: validGroup.length,
        companyCount,
        companyShare,
        difference: share !== null && companyShare !== null ? share - companyShare : null,
        theme,
      }
    }),
    (entry) => entry.count,
  )
}

function exitReasonItems(
  reasons: readonly ExitReasonEvidence[],
  companySampleSize: number,
): EvidenceItem[] {
  return reasons.filter((reason) => reason.theme !== null).map((reason): EvidenceItem => {
    const difference = reason.difference
    const isSmallSample = reason.sampleSize < MIN_ANALYSIS_SAMPLE_SIZE
    const supportsPattern = difference !== null && difference > EVIDENCE_EQUALITY_TOLERANCE
    const direction = difference === null
      ? 'not_comparable'
      : Math.abs(difference) < EVIDENCE_EQUALITY_TOLERANCE
        ? 'same'
        : difference < 0 ? 'lower' : 'higher'

    return {
      id: `exit:reason:${reason.reason}`,
      source: 'exit',
      theme: reason.theme as EvidenceTheme,
      metric: reason.reason,
      label: `Exit reason: ${reason.reason}`,
      unit: 'percentage',
      groupValue: reason.share,
      companyValue: reason.companyShare,
      difference,
      sampleSize: reason.sampleSize,
      companySampleSize,
      direction,
      strength: classifyItemStrength(
        difference, 'percentage', reason.sampleSize, companySampleSize, supportsPattern,
      ),
      isSmallSample,
      supportsPattern,
      note: `${reason.count} of ${reason.sampleSize} exit-survey responses in this group recorded “${reason.reason}” (${reason.share?.toFixed(1) ?? '—'}%; company ${reason.companyShare?.toFixed(1) ?? '—'}%)${isSmallSample ? '; small sample' : ''}.`,
    }
  })
}

function commentThemeMentions<T extends { comment: string }>(
  source: EvidenceSource,
  rows: readonly T[],
): CommentThemeMention[] {
  const comments = rows
    .map((row) => row.comment)
    .filter((comment) => comment.trim() !== '')
    .map(normaliseForMatching)

  return COMMENT_THEME_KEYWORDS.flatMap(({ theme, label, keywords }) => {
    const mentionCount = comments.filter((comment) =>
      keywords.some((keyword) => containsKeyword(comment, keyword)),
    ).length
    if (mentionCount === 0) return []
    return [{
      source,
      theme,
      label,
      mentionCount,
      totalComments: comments.length,
      percentage: percentage(mentionCount, comments.length),
      sampleSize: comments.length,
      isSmallSample: comments.length < MIN_ANALYSIS_SAMPLE_SIZE,
    }]
  })
}

function isMeaningfulEvidence(item: EvidenceItem): boolean {
  return item.supportsPattern && item.strength === 'moderate'
}

function buildDriverCandidates(
  items: readonly EvidenceItem[],
  commentMentions: readonly CommentThemeMention[],
): DriverCandidate[] {
  const byTheme = groupBy(items.filter((item) => item.supportsPattern), (item) => item.theme)
  return [...byTheme].map(([theme, themeItems]) => {
    const meaningful = themeItems.filter(isMeaningfulEvidence)
    const ordered = [
      ...sortDescending(meaningful, (item) => Math.abs(item.difference ?? 0)),
      ...sortDescending(
        themeItems.filter((item) => !meaningful.includes(item)),
        (item) => Math.abs(item.difference ?? 0),
      ),
    ]
    const meaningfulSources = new Set(meaningful.map((item) => item.source))
    const hasStrongGap = meaningful.some((item) =>
      item.unit === 'score'
        ? Math.abs(item.difference ?? 0) >= STRONG_SCORE_GAP
        : (item.difference ?? 0) >= STRONG_EXIT_SHARE_GAP,
    )
    const strength: EvidenceStrength = meaningfulSources.size >= 2 && hasStrongGap
      ? 'strong'
      : meaningful.length > 0 ? 'moderate' : 'limited'
    const sources = [...new Set(themeItems.map((item) => item.source))]
    const first = ordered[0]
    const relatedSources = sources.filter((source) => source !== first.source)

    return {
      theme,
      label: DRIVER_THEME_LABELS[theme] ?? first.label,
      sources,
      evidenceItems: ordered,
      commentMentions: commentMentions.filter((mention) => mention.theme === theme),
      sampleSize: Math.min(...(meaningful.length > 0 ? meaningful : themeItems).map((item) => item.sampleSize)),
      strength,
      summary: relatedSources.length > 0
        ? `${first.note} Related measures also differ in ${relatedSources.join(' and ')} responses. These are supporting signals, not a causal finding.`
        : `${first.note} This is a related signal, not a causal finding.`,
    }
  }).sort((a, b) => {
    const rank: Record<EvidenceStrength, number> = { strong: 0, moderate: 1, limited: 2 }
    return rank[a.strength] - rank[b.strength] || a.label.localeCompare(b.label)
  })
}

function groupSurveyRows<T extends { employeeId: string }>(
  rows: readonly T[],
  employeeIndex: Map<string, Employee>,
  getKey: (employee: Employee) => string,
): Map<string, T[]> {
  return groupBy(rows, (row) => {
    const employee = employeeIndex.get(row.employeeId)
    return employee ? nonEmpty(getKey(employee)) : null
  })
}

function buildHrEvidenceAnalysis(
  dataset: HrDataset,
  latestPulseRows: readonly PulseSurvey[],
  employeeIndex: Map<string, Employee>,
  divisions: readonly DivisionAnalysis[],
  employeeGroups: readonly EmployeeGroupAnalysis[],
  patterns: HrObservedPatterns,
): HrEvidenceAnalysis {
  const companyPulse = companyDimensionStats(latestPulseRows, PULSE_EVIDENCE_DIMENSIONS)
  const companyOnboarding = companyDimensionStats(dataset.onboardingSurveys, ONBOARDING_EVIDENCE_DIMENSIONS)
  const companyExit = companyDimensionStats(dataset.exitSurveys, EXIT_EVIDENCE_DIMENSIONS)
  const validCompanyReasons = dataset.exitSurveys.filter((row) => nonEmpty(row.primaryExitReason) !== null)
  const companyReasonCounts = countBy(validCompanyReasons, (row) => nonEmpty(row.primaryExitReason))
  const companyExitReasons: ExitReasonCount[] = sortDescending(
    [...companyReasonCounts].map(([reason, count]) => ({
      reason,
      count,
      share: percentage(count, validCompanyReasons.length),
      sampleSize: validCompanyReasons.length,
    })),
    (entry) => entry.count,
  )

  function forScope(
    scope: EvidenceAnalysis['scope'],
    names: readonly string[],
    getKey: (employee: Employee) => string,
  ): EvidenceAnalysis[] {
    const pulseGroups = groupSurveyRows(latestPulseRows, employeeIndex, getKey)
    const onboardingGroups = groupSurveyRows(dataset.onboardingSurveys, employeeIndex, getKey)
    const exitGroups = groupSurveyRows(dataset.exitSurveys, employeeIndex, getKey)

    return names.map((group) => {
      const pulseRows = pulseGroups.get(group) ?? []
      const onboardingRows = onboardingGroups.get(group) ?? []
      const exitRows = exitGroups.get(group) ?? []
      const pulse = scoreEvidenceItems('pulse', pulseRows, PULSE_EVIDENCE_DIMENSIONS, companyPulse)
      const onboarding = scoreEvidenceItems('onboarding', onboardingRows, ONBOARDING_EVIDENCE_DIMENSIONS, companyOnboarding)
      const exitReasons = exitReasonEvidence(exitRows, validCompanyReasons, companyReasonCounts)
      const exit = [
        ...scoreEvidenceItems('exit', exitRows, EXIT_EVIDENCE_DIMENSIONS, companyExit),
        ...exitReasonItems(exitReasons, validCompanyReasons.length),
      ]
      const commentThemes = [
        ...commentThemeMentions('pulse', pulseRows),
        ...commentThemeMentions('onboarding', onboardingRows),
        ...commentThemeMentions('exit', exitRows),
      ]
      const weakDimensions = sortDescending(
        [...pulse, ...onboarding, ...exit].filter((item) =>
          item.unit === 'score' && item.supportsPattern),
        (item) => Math.abs(item.difference ?? 0),
      )

      return {
        scope,
        group,
        weakDimensions,
        pulse,
        onboarding,
        exit,
        exitReasons,
        commentThemes,
        driverCandidates: buildDriverCandidates([...pulse, ...onboarding, ...exit], commentThemes),
      }
    })
  }

  const evidenceDivisions = forScope('division', divisions.map((entry) => entry.division), (employee) => employee.division)
  const evidenceGroups = forScope('employeeGroup', employeeGroups.map((entry) => entry.group), (employee) => employee.employeeGroup)
  const divisionIndex = new Map(evidenceDivisions.map((entry) => [entry.group, entry]))
  const groupIndex = new Map(evidenceGroups.map((entry) => [entry.group, entry]))
  const patternEvidenceById: Record<string, EvidenceAnalysis> = {}
  const lowestDivision = patterns.lowestEngagementDivision
  const highestLeaverDivision = patterns.highestLeaverRateDivision
  const lowestGroup = patterns.lowestEngagementEmployeeGroup
  if (lowestDivision) {
    const evidence = divisionIndex.get(lowestDivision.division)
    if (evidence) patternEvidenceById['division-engagement'] = evidence
  }
  if (highestLeaverDivision) {
    const evidence = divisionIndex.get(highestLeaverDivision.division)
    if (evidence) patternEvidenceById['division-leavers'] = evidence
  }
  if (lowestGroup) {
    const evidence = groupIndex.get(lowestGroup.group)
    if (evidence) patternEvidenceById['employee-group-engagement'] = evidence
  }

  return {
    companyExitReasons,
    divisions: evidenceDivisions,
    employeeGroups: evidenceGroups,
    patternEvidenceById,
  }
}

const analysisCache = new WeakMap<HrDataset, HrAnalysis>()
const analyticsCache = new WeakMap<HrDataset, HrAnalytics>()
const employeeIndexCache = new WeakMap<HrDataset, Map<string, Employee>>()

function getEmployeeIndex(dataset: HrDataset): Map<string, Employee> {
  const cached = employeeIndexCache.get(dataset)
  if (cached) return cached
  const index = buildEmployeeIndex(dataset.employees)
  employeeIndexCache.set(dataset, index)
  return index
}

/** Foundation only; no insights, priorities or recommendations are calculated here. */
export function calculateHrAnalysis(dataset: HrDataset): HrAnalysis {
  const cached = analysisCache.get(dataset)
  if (cached) return cached
  const workforce = calculateWorkforceMetrics(dataset.employees)
  const pulse = buildPulsePatternAnalysis(dataset.pulseSurveys)
  const employeeIndex = getEmployeeIndex(dataset)
  const latestPulseWaveRows = pulse.latestWave
    ? dataset.pulseSurveys.filter(
        (row) => row.surveyWave === pulse.latestWave?.wave,
      )
    : []
  const latestPulseRows = latestPulseWaveRows.filter((row) => isValidScore(row.engagementScore))
  const groupArgs = [
    dataset.employees,
    latestPulseRows,
    employeeIndex,
  ] as const
  const divisions: DivisionAnalysis[] = buildWorkforceGroupAnalysis(
    ...groupArgs,
    (employee) => employee.division,
    pulse.latestWave?.averageEngagement ?? null,
    workforce.leaverRate,
  ).map(({ group, ...metrics }) => ({ division: group, ...metrics }))
  const employeeGroups: EmployeeGroupAnalysis[] = buildWorkforceGroupAnalysis(
    ...groupArgs,
    (employee) => employee.employeeGroup,
    pulse.latestWave?.averageEngagement ?? null,
    workforce.leaverRate,
  )
  const patterns = buildObservedPatterns(divisions, employeeGroups, pulse)
  const baseAnalysis: Omit<HrAnalysis, 'priorities'> = {
    workforce,
    divisions: sortAscending(divisions, (entry) => entry.latestPulseEngagement),
    employeeGroups: sortAscending(employeeGroups, (entry) => entry.latestPulseEngagement),
    pulse,
    patterns,
    evidence: buildHrEvidenceAnalysis(
      dataset,
      latestPulseWaveRows,
      employeeIndex,
      divisions,
      employeeGroups,
      patterns,
    ),
    dataQuality: validateHrDataset(dataset),
  }
  const analysis: HrAnalysis = {
    ...baseAnalysis,
    priorities: buildSuggestedPriorityIssues(baseAnalysis),
  }
  analysisCache.set(dataset, analysis)
  return analysis
}

export function calculateHrAnalytics(dataset: HrDataset): HrAnalytics {
  const cached = analyticsCache.get(dataset)
  if (cached) return cached
  const foundation = calculateHrAnalysis(dataset)
  const employeeIndex = getEmployeeIndex(dataset)

  const employees = calculateEmployeeAnalytics(dataset.employees, foundation.workforce)
  const onboarding = calculateOnboardingAnalytics(dataset.onboardingSurveys, employeeIndex)
  const pulse = calculatePulseAnalytics(
    dataset.pulseSurveys,
    employeeIndex,
    dataset.dataDictionary,
  )
  const exits = calculateExitAnalytics(dataset.exitSurveys, employeeIndex)
  const actions = calculateActionAnalytics(dataset.actions)

  const analytics: HrAnalytics = {
    ...foundation,
    overview: buildOverview(employees, onboarding, pulse, exits, actions),
    employees,
    onboarding,
    pulse,
    exits,
    actions,
    divisions: buildDivisionRollup(employees, onboarding, pulse, exits),
    meta: {
      scoreScale: SCORE_SCALE,
      baseEngagementScale: BASE_ENGAGEMENT_SCALE,
      newJoinerMaxTenureMonths: NEW_JOINER_MAX_MONTHS,
      tenureBands: TENURE_BANDS,
      rowCounts: {
        employees: dataset.employees.length,
        onboardingSurveys: dataset.onboardingSurveys.length,
        pulseSurveys: dataset.pulseSurveys.length,
        exitSurveys: dataset.exitSurveys.length,
        actions: dataset.actions.length,
      },
    },
  }
  analyticsCache.set(dataset, analytics)
  return analytics
}
