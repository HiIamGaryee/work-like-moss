import {
  ESTABLISHED_GROUP_LABEL,
  EXIT_METRICS,
  NEW_JOINER_GROUP_LABEL,
  NEW_JOINER_MAX_MONTHS,
  ONBOARDING_DIMENSIONS,
  ONBOARDING_METRICS,
  PERCENTAGE_PRECISION,
  PULSE_SCORES,
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
import { ACTION_STATUSES, WOULD_RECOMMEND_VALUES } from '@/data/hr-data.constants'
import { validateHrDataset } from '@/services/hr-data-quality.service'
import type {
  ActionAnalytics,
  ActionScopeMetric,
  ActionThemeMetric,
  ChangeDirection,
  ChangeMetric,
  DivisionAnalytics,
  DivisionEmployeeMetric,
  EmployeeAnalytics,
  EmployeeCountMetrics,
  EmployeeGroupMetric,
  ExitAnalytics,
  ExitCommentRecord,
  ExitDivisionMetric,
  ExitReasonMetric,
  ExitScores,
  GroupMetric,
  HrAnalytics,
  MetricValue,
  NewJoinerMetrics,
  OnboardingAnalytics,
  OnboardingDimensionMetric,
  OnboardingGroupMetric,
  OnboardingScores,
  OverviewAnalytics,
  PulseAnalytics,
  PulseComparison,
  PulseGroupTrend,
  PulseScores,
  PulseSegment,
  PulseTrendPoint,
  PulseWave,
  ScoreDirection,
  ScoreInterpretation,
  TenureBandEmployeeMetric,
  TrendPoint,
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
 * CODE calculates the facts here. A later step lets AI *explain* these numbers;
 * it never produces them. Same dataset in, same numbers out — no randomness, no
 * network, no fallback values. Source arrays are treated as read-only.
 *
 * Invalid-value policy: a survey score outside the documented 1–5 scale (which
 * includes the `0` the parser writes for a blank cell) is excluded from that
 * one average rather than counted as zero, and an average with nothing valid
 * left is `null`, never `0`. The exclusions are reported in `dataQuality`.
 */

/* ------------------------------------------------------------------ helpers */

const validScore = (value: number): number | null => (isValidScore(value) ? value : null)

const validRatio = (value: number): number | null => (isValidBaseEngagement(value) ? value : null)

const toNullableDate = (value: string): string | null => (value.trim() === '' ? null : value)

const nonEmpty = (value: string): string | null => {
  const text = value.trim()
  return text === '' ? null : text
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
  const leaverCount = countWhere(employees, (employee) => employee.exitStatus === 'Leaver')

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

function calculateEmployeeAnalytics(employees: readonly Employee[]): EmployeeAnalytics {
  const totals = employeeCountMetrics(employees)

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
    totalEmployees: totals.employeeCount,
    activeEmployees: totals.activeCount,
    leavers: totals.leaverCount,
    activeRate: rate(totals.activeCount, totals.employeeCount),
    leaverRate: totals.leaverRate,
    averageBaseEngagement: totals.averageBaseEngagement,
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
  const waveAggregates = aggregateWaves(rows)
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
      comment: row.comment.trim(),
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

export function calculateHrAnalytics(dataset: HrDataset): HrAnalytics {
  const employeeIndex = buildEmployeeIndex(dataset.employees)

  const employees = calculateEmployeeAnalytics(dataset.employees)
  const onboarding = calculateOnboardingAnalytics(dataset.onboardingSurveys, employeeIndex)
  const pulse = calculatePulseAnalytics(
    dataset.pulseSurveys,
    employeeIndex,
    dataset.dataDictionary,
  )
  const exits = calculateExitAnalytics(dataset.exitSurveys, employeeIndex)
  const actions = calculateActionAnalytics(dataset.actions)

  return {
    overview: buildOverview(employees, onboarding, pulse, exits, actions),
    employees,
    onboarding,
    pulse,
    exits,
    actions,
    divisions: buildDivisionRollup(employees, onboarding, pulse, exits),
    dataQuality: validateHrDataset(dataset),
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
}

