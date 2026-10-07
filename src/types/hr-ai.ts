import type { InsightDataSource } from '@/types/hr-insights'

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
}

export interface HrAiEvidenceTheme {
  theme: string
  reason: string
  sourceCount: number
}

export interface HrAiInvestigationArea {
  title: string
  reason: string
}

export interface HrAiSuggestedAction {
  title: string
  description: string
  measurementSuggestion?: string
}

export interface HrAiDraft {
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
