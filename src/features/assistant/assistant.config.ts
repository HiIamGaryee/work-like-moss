import type { OnboardingScores, PulseScores } from '@/types/hr-analytics'
import type { AssistantIntent } from '@/features/assistant/assistant.types'

export const QUESTION_CATEGORIES = [
  {
    label: 'Overview',
    questions: ['Give me a CEO brief.', 'How are we doing overall?', 'What needs my attention?'],
  },
  {
    label: 'Engagement',
    questions: ['Which division has the lowest engagement?', 'Has engagement changed recently?'],
  },
  {
    label: 'People',
    questions: ['How many employees do we have?', 'What are the main exit reasons?'],
  },
  {
    label: 'Actions',
    questions: ['What is our top priority?', 'Give me action status.', 'Give me outcome status.'],
  },
] as const

export const QUESTION_INTENTS: readonly {
  intent: Exclude<
    AssistantIntent,
    'division_summary' | 'division_metric' | 'employee_group_summary' | 'unknown'
  >
  phrases: readonly string[]
}[] = [
  {
    intent: 'individual_risk',
    phrases: ['who is likely to resign', 'which employee is unhappy', 'show risky employees', 'employee risk score'],
  },
  { intent: 'ceo_brief', phrases: ['ceo brief', 'give me a ceo brief', 'executive brief'] },
  { intent: 'show_number', phrases: ['show me the number', 'just give me the number', 'what is the value', 'the number'] },
  { intent: 'why_matters', phrases: ['why does this matter', 'why is this important', 'business relevance'] },
  {
    intent: 'linked_action',
    phrases: ['what are we doing about it', 'what are we doing', 'doing about', 'what action is linked', 'linked action'],
  },
  { intent: 'linked_impact', phrases: ['did it work', 'has it improved', 'did the action work', 'linked outcome'] },
  {
    intent: 'division_evidence',
    phrases: ['why is that', 'why is', 'why low', 'what is driving', 'what evidence', 'supporting evidence', 'possible driver', 'why'],
  },
  {
    intent: 'data_quality',
    phrases: ['can we trust this data', 'data quality', 'data quality issue', 'data issue', 'quality warning'],
  },
  { intent: 'risk', phrases: ['main risks', 'what are the risks', 'be careful about', 'key risks', 'risk summary'] },
  { intent: 'benefit', phrases: ['what value are we getting', 'why use work like moss', 'product value', 'what is the benefit'] },
  {
    intent: 'executive_summary',
    phrases: ['how are we doing', 'give me the overview', 'what is happening', "what's happening", 'what should i know', 'executive summary', 'overall summary'],
  },
  {
    intent: 'attention',
    phrases: ['what needs my attention', 'what should i look at first', 'what should i pay attention to today', 'biggest issue', 'strongest signal', 'management attention'],
  },
  {
    intent: 'engagement_trend',
    phrases: ['is engagement improving', 'has engagement improved', 'has engagement gone down', 'what changed since last pulse', 'engagement trend', 'engagement changed recently'],
  },
  { intent: 'division_comparison', phrases: ['compare with company', 'compare to company', 'below average', 'above average', 'how far below'] },
  { intent: 'top_engagement_division', phrases: ['top division', 'best engagement', 'highest engagement division', 'division above average', 'which division is above average'] },
  { intent: 'highest_leaver_rate', phrases: ['highest leaver rate', 'most exits by division', 'division has the most exits'] },
  { intent: 'employee_group_attention', phrases: ['employee group needs attention', 'lowest employee group', 'group needs attention'] },
  {
    intent: 'lowest_engagement_division',
    phrases: ['lowest engagement division', 'lowest engagement', 'worst division', 'division needs attention', 'who has the lowest engagement'],
  },
  { intent: 'technology_access', phrases: ['technology access', 'system access', 'tools access', 'access delay', 'getting access'] },
  { intent: 'exit_reasons', phrases: ['exit reasons', 'why are people leaving', 'why do employees leave', 'why people leave'] },
  { intent: 'exit_count', phrases: ['exit count', 'how many exits', 'how many employees left', 'recorded exits', 'review exits'] },
  { intent: 'action_status', phrases: ['give me action status', 'action status summary', 'suggested approved in progress completed', 'review actions'] },
  { intent: 'outcome_status', phrases: ['give me outcome status', 'outcome status summary', 'measurement status', 'review outcomes'] },
  { intent: 'open_actions', phrases: ['open actions', 'actions in progress', 'what is hr working on'] },
  { intent: 'priority', phrases: ['top priority', 'highest priority issue', 'management review first', 'what should we focus on'] },
  { intent: 'impact', phrases: ['are our actions working', 'actions showing improvement', 'proven impact', 'action impact'] },
  { intent: 'employee_count', phrases: ['employee count', 'total employees', 'how many employees', 'how many staff', 'headcount', 'workforce size'] },
  { intent: 'engagement', phrases: ['engagement score', 'company engagement', 'overall engagement', 'latest engagement', 'engagement like', 'engagement'] },
  { intent: 'help', phrases: ['help', 'what can i ask', 'what do you know', 'what can you answer'] },
]

type PulseMetricDefinition = {
  id: string
  label: string
  aliases: readonly string[]
  source: 'pulse'
  key: keyof PulseScores
}

type OnboardingMetricDefinition = {
  id: string
  label: string
  aliases: readonly string[]
  source: 'onboarding'
  key: keyof OnboardingScores
}

export type DivisionMetricDefinition = PulseMetricDefinition | OnboardingMetricDefinition

export const DIVISION_METRICS: readonly DivisionMetricDefinition[] = [
  { id: 'engagement', label: 'Engagement', aliases: ['engagement', 'engagement score'], source: 'pulse', key: 'engagement' },
  { id: 'manager_support', label: 'Manager Support', aliases: ['manager support'], source: 'pulse', key: 'managerSupport' },
  { id: 'career_growth', label: 'Career Growth', aliases: ['career growth', 'career development'], source: 'pulse', key: 'careerGrowth' },
  { id: 'workload', label: 'Workload', aliases: ['workload', 'work pressure'], source: 'pulse', key: 'workload' },
  { id: 'belonging', label: 'Belonging', aliases: ['belonging', 'sense of belonging'], source: 'pulse', key: 'belonging' },
  { id: 'onboarding_overall', label: 'Onboarding', aliases: ['onboarding', 'new joiner experience'], source: 'onboarding', key: 'averageOverallScore' },
  { id: 'role_clarity', label: 'Role Clarity', aliases: ['role clarity', 'clear role'], source: 'onboarding', key: 'averageRoleClarity' },
  { id: 'tools_access', label: 'Tools Access', aliases: ['tools access', 'system access', 'technology access', 'access delay'], source: 'onboarding', key: 'averageToolsAccess' },
]

export const CLARIFICATION_OPTIONS = [
  'Review engagement',
  'Review exits',
  'Review actions',
  'Review outcomes',
] as const
