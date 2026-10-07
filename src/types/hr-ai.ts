import type { InsightDataSource } from '@/types/hr-insights'

export type HrAiMode =
  | 'hr-business-partner'
  | 'employee-engagement'
  | 'retention-exit'
  | 'onboarding-experience'
  | 'organisational-development'

export type HrAiDepth = 'quick' | 'standard' | 'deep'

export interface HrAiGenerationOptions {
  mode: HrAiMode
  depth: HrAiDepth
  focusAreas: string[]
  customInstruction?: string
}

export interface HrAiDraftInput {
  signalTitle: string
  affectedGroup: string
  metric: string
  currentValue: number | null
  benchmark: number | null
  variance: number | null
  sampleSize: number
  signalStrength: string
  evidenceSources: InsightDataSource[]
  aggregatedThemes: string[]
  likelyDrivers: string[]
  existingRecommendationContext?: string
  mode?: HrAiMode
  depth?: HrAiDepth
  focusAreas?: string[]
  customInstruction?: string
}

export interface HrAiEvidenceTheme {
  theme: string
  reason: string
  sourceCount: number
}

export interface HrAiInvestigationArea {
  title: string
  reason: string
  evidenceBasis?: string
}

export interface HrAiSuggestedAction {
  title: string
  description: string
  measurementSuggestion?: string
  suggestedOwner?: string
  suggestedMeasure?: string
}

export interface HrAiDraft {
  mode?: HrAiMode
  executiveSummary?: string
  observedSignal?: string
  evidenceInterpretation?: string
  questionsForHr?: string[]
  summary: string
  evidenceThemes: HrAiEvidenceTheme[]
  possibleExplanation: string
  investigationAreas: HrAiInvestigationArea[]
  suggestedActions: HrAiSuggestedAction[]
  limitations: string[]
}

export type HrAiDraftSource = 'ai-assisted' | 'rule-based'

export interface HrAiDraftResult {
  draft: HrAiDraft | null
  source: HrAiDraftSource
  available: boolean
  message?: string
}
