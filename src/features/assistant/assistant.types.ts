import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrAction, RecommendedAction } from '@/types/hr-actions'
import type { ActionImpact, ImpactSummary } from '@/types/hr-impact'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'

export type AssistantIntent =
  | 'ceo_brief'
  | 'executive_summary'
  | 'attention'
  | 'employee_count'
  | 'engagement'
  | 'engagement_trend'
  | 'lowest_engagement_division'
  | 'top_engagement_division'
  | 'highest_leaver_rate'
  | 'division_summary'
  | 'division_metric'
  | 'division_comparison'
  | 'division_evidence'
  | 'employee_group_summary'
  | 'employee_group_attention'
  | 'technology_access'
  | 'exit_count'
  | 'exit_reasons'
  | 'action_status'
  | 'open_actions'
  | 'priority'
  | 'outcome_status'
  | 'impact'
  | 'linked_action'
  | 'linked_impact'
  | 'why_matters'
  | 'show_number'
  | 'data_quality'
  | 'risk'
  | 'benefit'
  | 'individual_risk'
  | 'help'
  | 'unknown'

export type AssistantSeverity = 'neutral' | 'attention' | 'positive'

export type AssistantSource =
  | 'Employees'
  | 'Pulse'
  | 'Onboarding'
  | 'Exit'
  | 'Actions'
  | 'Impact'

export type AssistantMetric = {
  label: string
  value: string
  comparison?: string
}

export type AssistantSection = {
  label: string
  content: string
}

export type AssistantAnswer = {
  text: string
  metric?: AssistantMetric
  severity?: AssistantSeverity
  sources?: AssistantSource[]
  evidenceQuality?: string
  sections?: AssistantSection[]
  followUps?: string[]
  clarificationOptions?: string[]
  relatedRoute?: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  answer?: AssistantAnswer
}

export type AssistantContext = {
  lastIntent?: AssistantIntent
  lastDivision?: string
  lastEmployeeGroup?: string
  lastIssueId?: string
  lastActionId?: string
  lastTopic?: string
  lastMetric?: AssistantMetric
}

export type AssistantData = {
  analytics: HrAnalytics
  intelligenceItems: HrIntelligenceItem[]
  recommendations: RecommendedAction[]
  actions: HrAction[]
  impacts: ActionImpact[]
  impactSummary: ImpactSummary
}

export type AssistantRequest = AssistantData & {
  question: string
  context: AssistantContext
}

export type ParsedQuestion = {
  intent: AssistantIntent
  division?: string
  employeeGroup?: string
  metricId?: string
  confidence: number
}

export type AssistantResponse = {
  answer: AssistantAnswer
  context: AssistantContext
}

export type ExecutiveSnapshotItem = {
  label: string
  value: string
  detail?: string
  severity?: AssistantSeverity
}
