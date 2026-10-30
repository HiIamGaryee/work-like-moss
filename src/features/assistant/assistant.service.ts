import {
  CLARIFICATION_OPTIONS,
  DIVISION_METRICS,
  type DivisionMetricDefinition,
} from '@/features/assistant/assistant.config'
import { normaliseQuestion, parseQuestion } from '@/features/assistant/assistant.parser'
import type {
  AssistantAnswer,
  AssistantContext,
  AssistantData,
  AssistantIntent,
  AssistantRequest,
  AssistantResponse,
  AssistantSource,
  ExecutiveSnapshotItem,
  ParsedQuestion,
} from '@/features/assistant/assistant.types'
import { MIN_ANALYSIS_SAMPLE_SIZE, SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { DivisionAnalytics, EmployeeGroupAnalysis, EvidenceAnalysis } from '@/types/hr-analytics'
import type { HrAction, RecommendedAction } from '@/types/hr-actions'
import type { ActionImpact } from '@/types/hr-impact'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import { formatCount, formatDate, formatPercentage, formatScoreOutOf, isRateMetricLabel } from '@/utils/format'

type BuilderInput = AssistantData & {
  parsed: ParsedQuestion
  context: AssistantContext
}

type BuiltAnswer = {
  answer: AssistantAnswer
  contextPatch?: Partial<AssistantContext>
}

type ResponseBuilder = (input: BuilderInput) => BuiltAnswer

const helpText =
  'Ask about workforce size, engagement, divisions, employee groups, exits, priorities, actions, outcomes, or data quality.'

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function score(value: number | null | undefined): string {
  return finite(value) ? formatScoreOutOf(value, SCORE_SCALE.max) : 'Not available'
}

function impactValue(value: number, unit: 'score' | 'percentage' | 'count'): string {
  if (unit === 'score') return score(value)
  if (unit === 'percentage') return formatPercentage(value)
  return formatCount(value)
}

function answer(text: string, details: Omit<AssistantAnswer, 'text'> = {}): BuiltAnswer {
  return { answer: { text, ...details } }
}

function smallSample(sampleSize: number): string | undefined {
  return sampleSize < MIN_ANALYSIS_SAMPLE_SIZE ? 'Small sample' : undefined
}

function sampleCaution(sampleSize: number): string {
  return sampleSize < MIN_ANALYSIS_SAMPLE_SIZE
    ? ' Treat this as an investigation signal because the sample is small.'
    : ''
}

function comparison(value: number, company: number | null): string | undefined {
  if (!finite(value) || !finite(company)) return undefined
  const difference = value - company
  if (Math.abs(difference) < 0.01) return 'In line with company'
  return `${Math.abs(difference).toFixed(2)} points ${difference > 0 ? 'above' : 'below'} company`
}

function topItem(items: HrIntelligenceItem[]): HrIntelligenceItem | undefined {
  return items.reduce<HrIntelligenceItem | undefined>(
    (current, item) => (!current || item.priority.score > current.priority.score ? item : current),
    undefined,
  )
}

function itemForContext(input: BuilderInput): HrIntelligenceItem | undefined {
  const { parsed, context, intelligenceItems } = input
  const byId = intelligenceItems.find(({ insight }) => insight.id === context.lastIssueId)
  const byScope = intelligenceItems.find(({ insight }) =>
      parsed.division
        ? insight.scope.key?.toLowerCase() === parsed.division.toLowerCase()
          || normaliseQuestion(insight.affectedScope).includes(normaliseQuestion(parsed.division))
        : parsed.employeeGroup
          ? insight.scope.key?.toLowerCase() === parsed.employeeGroup.toLowerCase()
          : false,
    )
  return byId ?? byScope ?? (
    parsed.division || parsed.employeeGroup || context.lastDivision || context.lastEmployeeGroup
      ? undefined
      : topItem(intelligenceItems)
  )
}

function sourceBadges(item: HrIntelligenceItem | undefined): AssistantSource[] {
  if (!item) return []
  const mapped = item.insight.dataSources.map<AssistantSource | null>((source) => {
    if (source === 'Employees') return 'Employees'
    if (source === 'Pulse Survey') return 'Pulse'
    if (source === 'Onboarding Survey') return 'Onboarding'
    if (source === 'Exit Survey') return 'Exit'
    if (source === 'Action Tracker') return 'Actions'
    return null
  })
  return [...new Set(mapped.filter((source): source is AssistantSource => source !== null))]
}

function evidenceLabel(item: HrIntelligenceItem | undefined): string | undefined {
  if (!item) return undefined
  const label = item.insight.signalStrength
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} evidence`
}

function formatInsightValue(item: HrIntelligenceItem): string | undefined {
  const value = item.insight.currentValue
  if (!finite(value)) return undefined
  return isRateMetricLabel(item.insight.metricLabel)
    ? formatPercentage(value)
    : formatScoreOutOf(value, SCORE_SCALE.max)
}

function divisionByName(input: BuilderInput): DivisionAnalytics | undefined {
  if (!input.parsed.division) return undefined
  return input.analytics.divisions.find(
    ({ division }) => division.toLowerCase() === input.parsed.division?.toLowerCase(),
  )
}

function employeeGroupByName(input: BuilderInput): EmployeeGroupAnalysis | undefined {
  if (!input.parsed.employeeGroup) return undefined
  return input.analytics.employeeGroups.find(
    ({ group }) => group.toLowerCase() === input.parsed.employeeGroup?.toLowerCase(),
  )
}

function evidenceForDivision(input: BuilderInput): EvidenceAnalysis | undefined {
  if (!input.parsed.division) return undefined
  return input.analytics.evidence.divisions.find(
    ({ group }) => group.toLowerCase() === input.parsed.division?.toLowerCase(),
  )
}

function actionCounts(input: AssistantData) {
  const suggested = input.recommendations.filter(({ reviewStatus }) => reviewStatus === 'pending-review').length
  const inProgress = input.analytics.actions.inProgressActions
    + input.actions.filter(({ status }) => status === 'in-progress').length
  const completed = input.analytics.actions.completedActions
    + input.actions.filter(({ status }) => status === 'completed').length
  const open = input.analytics.actions.openActions
    + input.actions.filter(({ status }) => status !== 'completed' && status !== 'cancelled').length
  return { suggested, approved: input.actions.length, inProgress, completed, open }
}

function linkedAction(input: BuilderInput, item: HrIntelligenceItem | undefined): HrAction | RecommendedAction | undefined {
  const scope = input.parsed.division ?? input.parsed.employeeGroup ?? item?.insight.affectedScope
  const scopeMatches = (value: string): boolean =>
    scope ? normaliseQuestion(value).includes(normaliseQuestion(scope)) : false
  return input.actions.find((entry) =>
    entry.id === input.context.lastActionId
    || scopeMatches(entry.affectedScope)
    || entry.issueId === item?.insight.id
    || entry.insightId === item?.insight.id,
  ) ?? input.recommendations.find((entry) =>
    scopeMatches(entry.affectedScope)
    || entry.issueId === item?.insight.id
    || entry.insightId === item?.insight.id,
  )
}

function linkedImpact(input: BuilderInput, item: HrIntelligenceItem | undefined, action?: HrAction | RecommendedAction): ActionImpact | undefined {
  const actionId = action && 'status' in action ? action.id : input.context.lastActionId
  const scope = input.parsed.division ?? input.parsed.employeeGroup ?? item?.insight.affectedScope
  return input.impacts.find((impact) =>
    impact.actionId === actionId
    || impact.issueId === item?.insight.id
    || impact.insightId === item?.insight.id
    || (scope ? normaliseQuestion(impact.affectedScope).includes(normaliseQuestion(scope)) : false),
  )
}

function actionSummary(action: HrAction | RecommendedAction | undefined): string {
  if (!action) return 'No action is currently linked to this issue.'
  if ('status' in action) return `${action.title} is ${action.status}, owned by ${action.owner}.`
  return `${action.title} is ${action.reviewStatus}, with ${action.suggestedOwner} as the suggested owner.`
}

function outcomeSummary(impact: ActionImpact | undefined): string {
  if (!impact) return 'No measurable outcome is currently linked to this issue.'
  if (impact.measurementStatus !== 'measurement-available') {
    return impact.actionStatus === 'completed'
      ? 'The action has been delivered, but the outcome is not measurable yet because no later comparable measurement is available.'
      : 'No comparable outcome measurement is available yet.'
  }
  return impact.interpretation
}

function buildCeoBrief(input: BuilderInput): BuiltAnswer {
  const item = topItem(input.intelligenceItems)
  const action = linkedAction(input, item)
  const impact = linkedImpact(input, item, action)
  const metricValue = item ? formatInsightValue(item) : undefined
  const metric = metricValue && item
    ? { label: item.insight.metricLabel, value: metricValue, comparison: item.insight.affectedScope }
    : undefined
  const built = answer('Current executive brief.', {
    severity: item ? 'attention' : 'neutral',
    sources: sourceBadges(item),
    evidenceQuality: evidenceLabel(item),
    metric,
    sections: [
      { label: 'Now', content: item ? `${item.insight.title} is the strongest current signal.` : 'No priority issue is currently available from the analysis.' },
      { label: 'Action', content: actionSummary(action) },
      { label: 'Measure', content: outcomeSummary(impact) },
    ],
    followUps: item ? ['Why?', 'What are we doing about it?', 'Did it work?', 'Show me the number'] : undefined,
    relatedRoute: '/',
  })
  return {
    ...built,
    contextPatch: {
      lastIssueId: item?.insight.id,
      ...(item?.insight.scope.kind === 'division' && item.insight.scope.key
        ? { lastDivision: item.insight.scope.key }
        : {}),
      ...(item?.insight.scope.kind === 'employee-group' && item.insight.scope.key
        ? { lastEmployeeGroup: item.insight.scope.key }
        : {}),
      lastActionId: action && 'status' in action ? action.id : undefined,
      lastMetric: metric,
      lastTopic: item?.insight.title,
    },
  }
}

function buildExecutiveSummary(input: BuilderInput): BuiltAnswer {
  const item = topItem(input.intelligenceItems)
  const counts = actionCounts(input)
  const engagement = input.analytics.overview.latestPulse.engagement
  const metric = finite(engagement)
    ? { label: 'Latest Engagement', value: score(engagement), comparison: `${formatCount(input.analytics.overview.latestPulse.responseCount)} responses` }
    : undefined
  const text = finite(engagement)
    ? `Overall engagement is ${score(engagement)}. ${item ? `The strongest current signal is ${item.insight.title}.` : 'No priority issue is currently available.'}`
    : item ? `The strongest current signal is ${item.insight.title}.` : 'No executive summary is currently available.'
  return {
    ...answer(text, {
      metric,
      severity: item ? 'attention' : 'neutral',
      sources: ['Employees', 'Pulse', 'Actions', 'Impact'],
      sections: [
        { label: 'Action', content: `${formatCount(counts.open)} actions are currently open.` },
        { label: 'Measure', content: `${formatCount(input.impactSummary.awaitingMeasurement)} outcomes are awaiting comparable measurement.` },
      ],
      followUps: ['What needs my attention?', 'Give me a CEO brief.', 'Give me outcome status.'],
      relatedRoute: '/',
    }),
    contextPatch: { lastIssueId: item?.insight.id, lastMetric: metric, lastTopic: item?.insight.title },
  }
}

function buildAttention(input: BuilderInput): BuiltAnswer {
  const item = topItem(input.intelligenceItems)
  if (!item) return answer('No priority issue is currently available from the analysis.')
  const metricValue = formatInsightValue(item)
  const metric = metricValue ? { label: item.insight.metricLabel, value: metricValue, comparison: item.insight.affectedScope } : undefined
  return {
    ...answer(`Top priority: ${item.insight.title}.`, {
      metric,
      severity: 'attention',
      evidenceQuality: evidenceLabel(item),
      sources: sourceBadges(item),
      sections: [
        { label: 'Why it matters', content: item.priority.reasons[0] ?? item.priority.explanation },
        { label: 'Priority', content: `${item.priority.level} · ${item.priority.score.toFixed(0)} / 100` },
      ],
      followUps: ['Why?', 'Why does this matter?', 'What are we doing about it?'],
    }),
    contextPatch: {
      lastIssueId: item.insight.id,
      ...(item.insight.scope.kind === 'division' && item.insight.scope.key
        ? { lastDivision: item.insight.scope.key }
        : {}),
      ...(item.insight.scope.kind === 'employee-group' && item.insight.scope.key
        ? { lastEmployeeGroup: item.insight.scope.key }
        : {}),
      lastMetric: metric,
      lastTopic: item.insight.title,
    },
  }
}

function buildEmployeeCount(input: BuilderInput): BuiltAnswer {
  const value = formatCount(input.analytics.workforce.totalEmployees)
  const metric = { label: 'Workforce', value, comparison: `${formatCount(input.analytics.workforce.activeEmployees)} active` }
  return { ...answer(`The supplied workforce dataset contains ${value} employees.`, { metric, sources: ['Employees'], relatedRoute: '/' }), contextPatch: { lastMetric: metric, lastTopic: 'Workforce' } }
}

function buildEngagement(input: BuilderInput): BuiltAnswer {
  const latest = input.analytics.overview.latestPulse
  if (!finite(latest.engagement)) return answer('No company pulse engagement result is currently available.')
  const previous = input.analytics.pulse.trend[input.analytics.pulse.trend.length - 2]
  const metric = {
    label: 'Latest Engagement',
    value: score(latest.engagement),
    ...(finite(previous?.engagement) ? { comparison: `Previous ${score(previous.engagement)}` } : {}),
  }
  return {
    ...answer(`Latest company engagement is ${metric.value}, based on ${formatCount(latest.responseCount)} responses.`, {
      metric,
      sources: ['Pulse'],
      followUps: ['Has engagement changed recently?', 'Which division has the lowest engagement?'],
      relatedRoute: '/',
    }),
    contextPatch: { lastMetric: metric, lastTopic: 'Company engagement' },
  }
}

function buildEngagementTrend(input: BuilderInput): BuiltAnswer {
  const change = input.analytics.pulse.engagementChange
  if (!change || !finite(change.from) || !finite(change.to)) return answer('No comparable pulse trend is currently available.')
  const direction = change.direction === 'flat' ? 'stable' : change.direction === 'up' ? 'improving' : 'declining'
  const difference = finite(change.absoluteChange) ? change.absoluteChange : change.to - change.from
  const latest = input.analytics.pulse.trend[input.analytics.pulse.trend.length - 1]
  const previous = input.analytics.pulse.trend[input.analytics.pulse.trend.length - 2]
  const metric = { label: 'Engagement Trend', value: score(change.to), comparison: `Previous ${score(change.from)}` }
  return {
    ...answer(`Engagement is ${direction}, moving from ${score(change.from)} to ${score(change.to)}.`, {
      metric,
      severity: change.direction === 'down' ? 'attention' : change.direction === 'up' ? 'positive' : 'neutral',
      sources: ['Pulse'],
      sections: [
        { label: 'Change', content: `${Math.abs(difference).toFixed(2)} points across comparable pulse periods.` },
        { label: 'Evidence', content: `${formatCount(latest?.responseCount ?? 0)} latest responses and ${formatCount(previous?.responseCount ?? 0)} previous responses.` },
      ],
      followUps: ['Which division has the lowest engagement?', 'What needs my attention?'],
    }),
    contextPatch: { lastMetric: metric, lastTopic: 'Engagement trend' },
  }
}

function buildLowestDivision(input: BuilderInput): BuiltAnswer {
  const lowest = input.analytics.patterns.lowestEngagementDivision
  if (!lowest || !finite(lowest.latestPulseEngagement)) return answer('No comparable division engagement result is currently available.')
  const company = input.analytics.overview.latestPulse.engagement
  const item = input.intelligenceItems.find(({ insight }) => insight.scope.key === lowest.division)
  const metric = { label: `${lowest.division} Engagement`, value: score(lowest.latestPulseEngagement), ...(finite(company) ? { comparison: `Company ${score(company)}` } : {}) }
  return {
    ...answer(`${lowest.division} has the lowest division engagement at ${metric.value}.`, {
      metric,
      severity: 'attention',
      evidenceQuality: smallSample(lowest.latestPulseResponseCount) ?? evidenceLabel(item),
      sources: ['Pulse'],
      sections: [
        { label: 'Why it matters', content: 'This is the strongest current division-level engagement signal.' },
        { label: 'Evidence', content: `${formatCount(lowest.latestPulseResponseCount)} valid responses.${sampleCaution(lowest.latestPulseResponseCount)}` },
      ],
      followUps: ['Why?', 'Why does this matter?', 'What are we doing about it?', 'Did it work?'],
    }),
    contextPatch: { lastDivision: lowest.division, lastIssueId: item?.insight.id, lastMetric: metric, lastTopic: `${lowest.division} engagement` },
  }
}

function buildTopDivision(input: BuilderInput): BuiltAnswer {
  const top = input.analytics.divisions.reduce<DivisionAnalytics | undefined>((current, division) => {
    const value = division.pulse?.latest?.engagement
    const currentValue = current?.pulse?.latest?.engagement
    if (!finite(value)) return current
    return !current || !finite(currentValue) || value > currentValue ? division : current
  }, undefined)
  const value = top?.pulse?.latest?.engagement
  if (!top || !finite(value)) return answer('No comparable division engagement result is currently available.')
  const sample = top.pulse?.latest?.responseCount ?? 0
  const metric = { label: `${top.division} Engagement`, value: score(value), comparison: `${formatCount(sample)} responses` }
  return { ...answer(`${top.division} has the highest latest division engagement at ${metric.value}.`, { metric, sources: ['Pulse'], evidenceQuality: smallSample(sample), followUps: [`Tell me about ${top.division}.`, 'Compare with company.'] }), contextPatch: { lastDivision: top.division, lastMetric: metric, lastTopic: `${top.division} engagement` } }
}

function buildHighestLeaverRate(input: BuilderInput): BuiltAnswer {
  const division = input.analytics.employees.highestLeaverRateDivision
  if (!division || !finite(division.leaverRate)) return answer('No division leaver-rate comparison is currently available.')
  const metric = { label: `${division.division} Leaver Rate`, value: formatPercentage(division.leaverRate), comparison: `${formatCount(division.leaverCount)} recorded leavers` }
  return { ...answer(`${division.division} has the highest recorded division leaver rate. This is descriptive, not an annualised turnover measure.`, { metric, sources: ['Employees'], severity: 'attention' }), contextPatch: { lastDivision: division.division, lastMetric: metric, lastTopic: `${division.division} leaver rate` } }
}

function metricDefinition(id: string | undefined): DivisionMetricDefinition | undefined {
  return DIVISION_METRICS.find((metric) => metric.id === id)
}

function readDivisionMetric(division: DivisionAnalytics, metric: DivisionMetricDefinition) {
  if (metric.source === 'pulse') return { value: division.pulse?.latest?.[metric.key] ?? null, sampleSize: division.pulse?.latest?.responseCount ?? 0 }
  return { value: division.onboarding?.[metric.key] ?? null, sampleSize: division.onboarding?.responseCount ?? 0 }
}

function companyMetric(input: BuilderInput, metric: DivisionMetricDefinition): number | null {
  return metric.source === 'pulse'
    ? input.analytics.overview.latestPulse[metric.key]
    : input.analytics.onboarding[metric.key]
}

function buildDivisionSummary(input: BuilderInput): BuiltAnswer {
  const division = divisionByName(input)
  if (!division) return answer('That division is not available in the current dataset.')
  const latest = division.pulse?.latest
  const item = input.intelligenceItems.find(({ insight }) => insight.scope.key === division.division)
  const metric = finite(latest?.engagement)
    ? { label: `${division.division} Engagement`, value: score(latest.engagement), comparison: comparison(latest.engagement, input.analytics.overview.latestPulse.engagement) }
    : { label: 'Workforce', value: formatCount(division.employees.employeeCount) }
  return {
    ...answer(`${division.division}: ${formatCount(division.employees.employeeCount)} employees.${finite(latest?.engagement) ? ` Engagement ${score(latest.engagement)}.` : ''} Leaver rate ${formatPercentage(division.employees.leaverRate)}.`, {
      metric,
      sources: ['Employees', ...(latest ? ['Pulse' as const] : [])],
      evidenceQuality: latest ? smallSample(latest.responseCount) ?? evidenceLabel(item) : undefined,
      followUps: ['Why?', 'Why does this matter?', 'What are we doing about it?'],
    }),
    contextPatch: { lastDivision: division.division, lastIssueId: item?.insight.id, lastMetric: metric, lastTopic: division.division },
  }
}

function buildDivisionMetric(input: BuilderInput): BuiltAnswer {
  const division = divisionByName(input)
  const definition = metricDefinition(input.parsed.metricId)
  if (!division || !definition) return answer('That metric is not available for the requested division.')
  const result = readDivisionMetric(division, definition)
  if (!finite(result.value)) return answer(`${definition.label} is not available for ${division.division}.`)
  const company = companyMetric(input, definition)
  const metric = { label: `${division.division} ${definition.label}`, value: score(result.value), comparison: comparison(result.value, company) }
  return {
    ...answer(`${division.division} ${definition.label.toLowerCase()} is ${metric.value}.`, {
      metric,
      sources: [definition.source === 'pulse' ? 'Pulse' : 'Onboarding'],
      evidenceQuality: smallSample(result.sampleSize),
      sections: [{ label: 'Evidence', content: `${formatCount(result.sampleSize)} responses.${sampleCaution(result.sampleSize)}` }],
      followUps: ['Why?', 'Compare with company.', 'What are we doing about it?'],
    }),
    contextPatch: { lastDivision: division.division, lastMetric: metric, lastTopic: metric.label },
  }
}

function buildDivisionComparison(input: BuilderInput): BuiltAnswer {
  const division = divisionByName(input)
  const definition = metricDefinition(input.parsed.metricId ?? 'engagement')
  if (!division || !definition) return answer('That comparison is not available.')
  const result = readDivisionMetric(division, definition)
  const company = companyMetric(input, definition)
  if (!finite(result.value) || !finite(company)) return answer('No same-period company comparison is currently available.')
  const comparisonValue = comparison(result.value, company) ?? 'Not comparable'
  const metric = { label: `${division.division} ${definition.label}`, value: score(result.value), comparison: `Company ${score(company)}` }
  return { ...answer(`${division.division} is ${comparisonValue.toLowerCase()} for ${definition.label.toLowerCase()}, using the same current measurement period.`, { metric, sources: [definition.source === 'pulse' ? 'Pulse' : 'Onboarding'], evidenceQuality: smallSample(result.sampleSize), followUps: ['Why?', 'Why does this matter?'] }), contextPatch: { lastDivision: division.division, lastMetric: metric, lastTopic: metric.label } }
}

function buildEmployeeGroupSummary(input: BuilderInput): BuiltAnswer {
  const group = employeeGroupByName(input)
  if (!group) return answer('That employee group is not available in the current analysis.')
  const metric = finite(group.latestPulseEngagement)
    ? { label: `${group.group} Engagement`, value: score(group.latestPulseEngagement), comparison: comparison(group.latestPulseEngagement, input.analytics.overview.latestPulse.engagement) }
    : { label: 'Group Size', value: formatCount(group.employeeCount) }
  return { ...answer(`${group.group} includes ${formatCount(group.employeeCount)} employees.${finite(group.latestPulseEngagement) ? ` Latest engagement is ${score(group.latestPulseEngagement)} based on ${formatCount(group.latestPulseResponseCount)} responses.` : ''}`, { metric, sources: ['Employees', 'Pulse'], evidenceQuality: group.isSmallSample ? 'Small sample' : undefined, followUps: ['Why?', 'Why does this matter?'] }), contextPatch: { lastEmployeeGroup: group.group, lastMetric: metric, lastTopic: group.group } }
}

function buildEmployeeGroupAttention(input: BuilderInput): BuiltAnswer {
  const group = input.analytics.patterns.lowestEngagementEmployeeGroup
  if (!group || !finite(group.latestPulseEngagement)) return answer('No employee-group priority is currently available from the analysis.')
  const metric = { label: `${group.group} Engagement`, value: score(group.latestPulseEngagement), comparison: comparison(group.latestPulseEngagement, input.analytics.overview.latestPulse.engagement) }
  return { ...answer(`${group.group} currently has the lowest employee-group engagement signal.`, { metric, severity: 'attention', sources: ['Pulse'], evidenceQuality: group.isSmallSample ? 'Small sample' : undefined, followUps: [`Tell me about ${group.group}.`, 'Why does this matter?'] }), contextPatch: { lastEmployeeGroup: group.group, lastMetric: metric, lastTopic: group.group } }
}

function buildTechnologyAccess(input: BuilderInput): BuiltAnswer {
  const newJoiners = input.analytics.onboarding.newJoiners
  const value = newJoiners?.averageToolsAccess ?? input.analytics.onboarding.averageToolsAccess
  const sample = newJoiners?.responseCount ?? input.analytics.onboarding.responseCount
  if (!finite(value)) return answer('Tools-access onboarding data is not currently available.')
  const metric = { label: newJoiners ? 'New-Joiner Tools Access' : 'Tools Access', value: score(value), comparison: `${formatCount(sample)} responses` }
  return { ...answer(`${metric.label}: ${metric.value}. Treat this as a signal, not a confirmed cause.`, { metric, sources: ['Onboarding'], evidenceQuality: smallSample(sample), followUps: ['Why does this matter?', 'What needs my attention?'] }), contextPatch: { lastMetric: metric, lastTopic: metric.label } }
}

function buildExitCount(input: BuilderInput): BuiltAnswer {
  const metric = { label: 'Recorded Leavers', value: formatCount(input.analytics.workforce.leavers), comparison: `${formatCount(input.analytics.exits.responseCount)} exit responses` }
  return { ...answer(`The workforce dataset contains ${metric.value} employees recorded as leavers. This is not an annualised turnover rate.`, { metric, sources: ['Employees', 'Exit'], followUps: ['What are the main exit reasons?', 'Which division has the highest leaver rate?'] }), contextPatch: { lastMetric: metric, lastTopic: 'Recorded exits' } }
}

function buildExitReasons(input: BuilderInput): BuiltAnswer {
  const reasons = input.analytics.exits.topExitReasons.slice(0, 3)
  if (reasons.length === 0) return answer('No structured exit reasons are currently available.')
  return answer('The leading recorded exit reasons are shown below. They are stated reasons, not proven causes.', {
    sources: ['Exit'],
    sections: reasons.map(({ reason, count }) => ({ label: reason, content: `${formatCount(count)} recorded responses` })),
    followUps: ['Which division has the highest leaver rate?', 'What are the main risks?'],
  })
}

function buildActionStatus(input: BuilderInput): BuiltAnswer {
  const counts = actionCounts(input)
  return answer('Current action status is summarised below.', {
    sources: ['Actions'],
    sections: [
      { label: 'Suggested', content: formatCount(counts.suggested) },
      { label: 'Approved', content: formatCount(counts.approved) },
      { label: 'In Progress', content: formatCount(counts.inProgress) },
      { label: 'Completed', content: formatCount(counts.completed) },
    ],
    followUps: ['Are our actions working?', 'Give me outcome status.'],
  })
}

function buildOpenActions(input: BuilderInput): BuiltAnswer {
  const counts = actionCounts(input)
  const metric = { label: 'Open Actions', value: formatCount(counts.open), comparison: `${formatCount(counts.inProgress)} in progress` }
  return { ...answer(`${metric.value} tracked actions are open, including ${formatCount(counts.inProgress)} in progress.`, { metric, sources: ['Actions'], followUps: ['Give me action status.', 'Are our actions working?'] }), contextPatch: { lastMetric: metric, lastTopic: 'Open actions' } }
}

function buildPriority(input: BuilderInput): BuiltAnswer {
  return buildAttention(input)
}

function buildOutcomeStatus(input: BuilderInput): BuiltAnswer {
  const summary = input.impactSummary
  if (summary.actionsTracked === 0) return answer('No approved actions are currently available for outcome measurement.')
  return answer('Current measured outcome status is summarised below. Completion is kept separate from impact.', {
    sources: ['Impact'],
    sections: [
      { label: 'Improved', content: formatCount(summary.improved) },
      { label: 'No Clear Change', content: formatCount(summary.noClearChange) },
      { label: 'Declined', content: formatCount(summary.declined) },
      { label: 'Awaiting Measurement', content: formatCount(summary.awaitingMeasurement) },
      { label: 'Not Comparable', content: formatCount(summary.notComparable) },
    ],
    followUps: ['Are our actions working?', 'Give me a CEO brief.'],
  })
}

function buildImpact(input: BuilderInput): BuiltAnswer {
  const summary = input.impactSummary
  if (summary.actionsTracked === 0) return answer('No approved actions are currently available for outcome measurement.')
  return answer(`${formatCount(summary.completedActions)} actions are completed, while ${formatCount(summary.awaitingMeasurement)} outcomes still await comparable measurement.`, {
    sources: ['Actions', 'Impact'],
    sections: [{ label: 'Measured outcomes', content: `${formatCount(summary.improved)} improved · ${formatCount(summary.noClearChange)} no clear change · ${formatCount(summary.declined)} declined` }],
    followUps: ['Give me outcome status.', 'What are the main risks?'],
  })
}

function buildEvidence(input: BuilderInput): BuiltAnswer {
  const item = itemForContext(input)
  const divisionEvidence = evidenceForDivision(input)
  const drivers = item?.likelyDrivers.map(({ label }) => label)
    ?? divisionEvidence?.driverCandidates.map(({ label }) => label)
    ?? []
  if (drivers.length === 0) return answer('No supporting driver analysis is currently available for this signal.')
  return {
    ...answer(`The strongest related signals are ${drivers.slice(0, 2).join(' and ')}. These are hypotheses for HR validation, not proven causes.`, {
      sources: sourceBadges(item),
      evidenceQuality: evidenceLabel(item),
      followUps: ['Why does this matter?', 'What are we doing about it?'],
    }),
    contextPatch: { lastIssueId: item?.insight.id, lastTopic: item?.insight.title },
  }
}

function buildWhyMatters(input: BuilderInput): BuiltAnswer {
  const item = itemForContext(input)
  if (!item) return answer('No current issue context is available. Ask about a priority or division first.')
  const prepared = input.analytics.priorities.find(({ scopeName }) => scopeName === item.insight.scope.key)
  const reach = prepared ? ` It affects a prepared reach estimate of ${formatCount(prepared.affectedEmployees)} employees.` : ''
  return answer(`This matters because ${item.priority.reasons[0] ?? item.priority.explanation}.${reach}`, {
    severity: 'attention',
    sources: sourceBadges(item),
    evidenceQuality: evidenceLabel(item),
    followUps: ['Why?', 'What are we doing about it?', 'Did it work?'],
  })
}

function buildLinkedAction(input: BuilderInput): BuiltAnswer {
  const item = itemForContext(input)
  const action = linkedAction(input, item)
  if (!action) return answer('No action is currently linked to this issue.')
  const isApproved = 'status' in action
  const sections = isApproved
    ? [
        { label: 'Owner', content: action.owner },
        { label: 'Status', content: action.status },
        { label: 'Due', content: formatDate(action.dueDate) },
        { label: 'Success measure', content: action.successMeasure },
      ]
    : [
        { label: 'Suggested owner', content: action.suggestedOwner },
        { label: 'Review status', content: action.reviewStatus },
        { label: 'Success measure', content: action.successMeasure },
      ]
  return {
    ...answer(isApproved ? `The linked action is ${action.title}.` : `The suggested linked action is ${action.title}.`, {
      sources: ['Actions'],
      sections,
      followUps: ['Did it work?', 'Show me the number'],
    }),
    contextPatch: { lastIssueId: item?.insight.id, lastActionId: isApproved ? action.id : undefined, lastTopic: action.title },
  }
}

function buildLinkedImpact(input: BuilderInput): BuiltAnswer {
  const item = itemForContext(input)
  const action = linkedAction(input, item)
  const impact = linkedImpact(input, item, action)
  if (!impact) return answer('No measurable outcome is currently linked to this issue.')
  if (impact.measurementStatus !== 'measurement-available') {
    return answer(outcomeSummary(impact), { sources: ['Actions', 'Impact'], severity: 'neutral', followUps: ['What are we doing about it?', 'Give me outcome status.'] })
  }
  const metric = impact.measurement && finite(impact.measurement.currentValue)
    ? { label: impact.measurement.label, value: impactValue(impact.measurement.currentValue, impact.measurement.unit), ...(finite(impact.measurement.baselineValue) ? { comparison: `Baseline ${impactValue(impact.measurement.baselineValue, impact.measurement.unit)}` } : {}) }
    : undefined
  return { ...answer(`${impact.interpretation} This is an observed comparison and does not prove the action caused the change.`, { metric, sources: ['Impact'], severity: impact.outcomeStatus === 'improved' ? 'positive' : impact.outcomeStatus === 'declined' ? 'attention' : 'neutral', followUps: ['Show me the number', 'Why does this matter?'] }), contextPatch: { lastActionId: impact.actionId, lastMetric: metric, lastTopic: impact.actionTitle } }
}

function buildShowNumber(input: BuilderInput): BuiltAnswer {
  const metric = input.context.lastMetric
  return metric
    ? answer(metric.value, { metric, sources: [] })
    : answer('No current metric is in context. Ask about engagement, workforce, a division, or an outcome first.')
}

function buildDataQuality(input: BuilderInput): BuiltAnswer {
  const { warnings, errors } = input.analytics.dataQuality
  const concerns = [...errors, ...warnings].slice(0, 2)
  return answer(`The current dataset has ${formatCount(warnings.length)} warnings and ${formatCount(errors.length)} errors.`, {
    severity: errors.length > 0 ? 'attention' : 'neutral',
    sections: concerns.length > 0
      ? concerns.map((concern, index) => ({ label: index === 0 ? 'Primary concern' : 'Additional concern', content: concern }))
      : [{ label: 'Status', content: 'No data-quality concerns are currently reported.' }],
    followUps: ['What are the main risks?', 'Give me a CEO brief.'],
  })
}

function buildRisk(input: BuilderInput): BuiltAnswer {
  const smallSamples = input.analytics.divisions.filter(({ pulse }) =>
    pulse?.latest ? pulse.latest.responseCount < MIN_ANALYSIS_SAMPLE_SIZE : false,
  ).length
  return answer('Key analytical cautions:', {
    severity: input.analytics.dataQuality.errors.length > 0 ? 'attention' : 'neutral',
    sections: [
      { label: 'Data quality', content: `${formatCount(input.analytics.dataQuality.warnings.length)} warnings and ${formatCount(input.analytics.dataQuality.errors.length)} errors are currently reported.` },
      { label: 'Sample size', content: `${formatCount(smallSamples)} division pulse results use a small sample.` },
      { label: 'Interpretation', content: 'Signals are not causes. Delivery is not outcome success.' },
      { label: 'Privacy', content: 'Analysis remains at company, group, action, and outcome level.' },
    ],
    followUps: ['Can we trust this data?', 'Give me outcome status.'],
  })
}

function buildBenefit(): BuiltAnswer {
  return answer('Work Like Moss turns prepared people data into a traceable management workflow.', {
    sections: [
      { label: 'Detect', content: 'Surface workforce signals faster.' },
      { label: 'Explain', content: 'Keep supporting evidence visible.' },
      { label: 'Act', content: 'Connect priorities to accountable actions.' },
      { label: 'Measure', content: 'Separate delivery from observed outcomes.' },
    ],
  })
}

function buildIndividualRisk(): BuiltAnswer {
  return answer('Work Like Moss uses group-level signals. It does not score individual resignation risk or expose personal records.')
}

function buildHelp(): BuiltAnswer {
  return answer(helpText, { clarificationOptions: [...CLARIFICATION_OPTIONS] })
}

function buildUnknown(): BuiltAnswer {
  return answer('Which view would you like?', { clarificationOptions: [...CLARIFICATION_OPTIONS] })
}

const RESPONSE_BUILDERS: Record<AssistantIntent, ResponseBuilder> = {
  ceo_brief: buildCeoBrief,
  executive_summary: buildExecutiveSummary,
  attention: buildAttention,
  employee_count: buildEmployeeCount,
  engagement: buildEngagement,
  engagement_trend: buildEngagementTrend,
  lowest_engagement_division: buildLowestDivision,
  top_engagement_division: buildTopDivision,
  highest_leaver_rate: buildHighestLeaverRate,
  division_summary: buildDivisionSummary,
  division_metric: buildDivisionMetric,
  division_comparison: buildDivisionComparison,
  division_evidence: buildEvidence,
  employee_group_summary: buildEmployeeGroupSummary,
  employee_group_attention: buildEmployeeGroupAttention,
  technology_access: buildTechnologyAccess,
  exit_count: buildExitCount,
  exit_reasons: buildExitReasons,
  action_status: buildActionStatus,
  open_actions: buildOpenActions,
  priority: buildPriority,
  outcome_status: buildOutcomeStatus,
  impact: buildImpact,
  linked_action: buildLinkedAction,
  linked_impact: buildLinkedImpact,
  why_matters: buildWhyMatters,
  show_number: buildShowNumber,
  data_quality: buildDataQuality,
  risk: buildRisk,
  benefit: buildBenefit,
  individual_risk: buildIndividualRisk,
  help: buildHelp,
  unknown: buildUnknown,
}

export function buildExecutiveSnapshot(input: AssistantData): ExecutiveSnapshotItem[] {
  const item = topItem(input.intelligenceItems)
  const counts = actionCounts(input)
  const engagement = input.analytics.overview.latestPulse.engagement
  const outcome = input.impactSummary.actionsTracked === 0
    ? 'No measurements'
    : input.impactSummary.awaitingMeasurement > 0
      ? `${formatCount(input.impactSummary.awaitingMeasurement)} awaiting`
      : `${formatCount(input.impactSummary.improved)} improved`
  return [
    { label: 'Workforce', value: formatCount(input.analytics.workforce.totalEmployees), detail: 'employees' },
    { label: 'Latest Engagement', value: score(engagement), detail: `${formatCount(input.analytics.overview.latestPulse.responseCount)} responses` },
    { label: 'Highest Priority', value: item?.insight.title ?? 'No current issue', detail: item ? `${item.priority.level} · ${item.priority.score.toFixed(0)} / 100` : undefined, severity: item ? 'attention' : 'neutral' },
    { label: 'Open Actions', value: formatCount(counts.open), detail: `${formatCount(counts.inProgress)} in progress` },
    { label: 'Outcome Status', value: outcome, detail: 'comparable measurements', severity: input.impactSummary.declined > 0 ? 'attention' : 'neutral' },
  ]
}

export function buildAssistantResponse(request: AssistantRequest): AssistantResponse {
  const parsed = parseQuestion(request)
  const safeParsed = parsed.confidence < 0.55 && parsed.intent !== 'unknown'
    ? { ...parsed, intent: 'unknown' as const }
    : parsed
  const built = RESPONSE_BUILDERS[safeParsed.intent]({ ...request, parsed: safeParsed })
  return {
    answer: built.answer,
    context: {
      ...request.context,
      ...built.contextPatch,
      lastIntent: safeParsed.intent,
    },
  }
}
