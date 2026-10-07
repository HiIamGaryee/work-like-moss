import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import type { RecommendedAction } from '@/types/hr-actions'
import type {
  HrAiDraft,
  HrAiDraftInput,
  HrAiDraftResult,
} from '@/types/hr-ai'
import { isInsightDetailSuppressed } from '@/utils/insight-privacy'

/** Same-origin boundary expected to keep provider credentials server-side. */
export const HR_DRAFT_API_PATH = '/api/hr-draft'

export const isHrAiEnabled = (): boolean => import.meta.env.VITE_AI_ENABLED === 'true'

/** The secure handler must apply these instructions before calling a provider. */
export const HR_DRAFT_GUARDRAILS = [
  'Use only the supplied structured evidence; do not invent facts.',
  'Do not identify employees or infer sensitive personal attributes.',
  'Do not claim causation. Distinguish observations from hypotheses.',
  'Suggest investigation areas for HR to verify, not conclusions.',
  'HR review is mandatory. Never approve, reject, or execute an action.',
] as const

const asText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const asFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseStringArray(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null
  const values = value.filter(asText).map((entry) => entry.trim()).filter(Boolean)
  return values.length <= max ? values : values.slice(0, max)
}

function parseDraft(value: unknown): HrAiDraft | null {
  if (!isRecord(value) || !asText(value.summary) || !asText(value.possibleExplanation)) return null
  if (!Array.isArray(value.evidenceThemes) || !Array.isArray(value.investigationAreas) || !Array.isArray(value.suggestedActions)) return null

  const evidenceThemes = value.evidenceThemes.flatMap((entry) => {
    if (!isRecord(entry) || !asText(entry.theme) || !asText(entry.reason) || !asFiniteNumber(entry.sourceCount)) return []
    return [{ theme: entry.theme.trim(), reason: entry.reason.trim(), sourceCount: Math.max(0, Math.round(entry.sourceCount)) }]
  }).slice(0, 8)
  const investigationAreas = value.investigationAreas.flatMap((entry) => {
    if (!isRecord(entry) || !asText(entry.title) || !asText(entry.reason)) return []
    return [{ title: entry.title.trim(), reason: entry.reason.trim() }]
  }).slice(0, 6)
  const suggestedActions = value.suggestedActions.flatMap((entry) => {
    if (!isRecord(entry) || !asText(entry.title) || !asText(entry.description)) return []
    return [{
      title: entry.title.trim(),
      description: entry.description.trim(),
      ...(asText(entry.measurementSuggestion) ? { measurementSuggestion: entry.measurementSuggestion.trim() } : {}),
    }]
  }).slice(0, 6)
  const limitations = parseStringArray(value.limitations, 8)
  if (!limitations || evidenceThemes.length === 0 || investigationAreas.length === 0 || suggestedActions.length === 0) return null
  return {
    summary: value.summary.trim(),
    evidenceThemes,
    possibleExplanation: value.possibleExplanation.trim(),
    investigationAreas,
    suggestedActions,
    limitations,
  }
}

export function buildHrAiDraftInput(
  item: HrIntelligenceItem,
  analytics: HrAnalytics | null,
  recommendation: RecommendedAction | null,
): HrAiDraftInput | null {
  if (isInsightDetailSuppressed(item, analytics) || item.insight.sampleSize === undefined) return null
  const themes = item.likelyDrivers.flatMap((driver) => [
    driver.label,
    ...driver.evidence.map((evidence) => evidence.label),
  ])
  return {
    signalTitle: item.insight.title,
    affectedGroup: item.insight.affectedScope,
    metric: item.insight.metricLabel,
    currentValue: item.insight.currentValue ?? null,
    benchmark: item.insight.referenceValue ?? null,
    variance: item.insight.difference ?? null,
    sampleSize: item.insight.sampleSize,
    signalStrength: item.insight.signalStrength,
    evidenceSources: [...item.insight.dataSources],
    aggregatedThemes: [...new Set(themes)].slice(0, 12),
    likelyDrivers: item.likelyDrivers.map((driver) => driver.label),
    ...(recommendation ? { existingRecommendationContext: recommendation.title } : {}),
  }
}

function fallbackDraft(item: HrIntelligenceItem, recommendation: RecommendedAction | null): HrAiDraft {
  const drivers = item.likelyDrivers
  const evidenceThemes = drivers.length > 0
    ? drivers.map((driver) => ({
        theme: driver.label,
        reason: driver.explanation,
        sourceCount: driver.dataSources.length,
      }))
    : [{
        theme: 'Structured signal evidence',
        reason: 'The detected signal is supported by the available aggregate workforce measures.',
        sourceCount: item.insight.dataSources.length,
      }]
  return {
    summary: item.insight.summary,
    evidenceThemes,
    possibleExplanation: drivers[0]?.explanation
      ? `Evidence suggests ${drivers[0].explanation.charAt(0).toLowerCase()}${drivers[0].explanation.slice(1)}`
      : 'The available data indicates a pattern that HR should validate with the affected group.',
    investigationAreas: drivers.length > 0
      ? drivers.map((driver) => ({
          title: driver.label,
          reason: `HR should verify whether ${driver.explanation.charAt(0).toLowerCase()}${driver.explanation.slice(1)}`,
        }))
      : [{
          title: 'Validate the signal with the affected group',
          reason: 'HR should verify the pattern and context with the relevant business owner before selecting an intervention.',
        }],
    suggestedActions: recommendation ? [{
      title: recommendation.title,
      description: recommendation.description,
      measurementSuggestion: recommendation.successMeasure,
    }] : [{
      title: 'Validate the signal with the affected group',
      description: 'Review the available evidence with HR and the relevant business owner before selecting an intervention.',
    }],
    limitations: [
      'This draft is limited to available aggregate evidence.',
      'Observed patterns do not establish causation.',
      ...(item.insight.dataSources.length === 1 ? ['Only one evidence source supports this signal.'] : []),
    ],
  }
}

export async function generateHrDraft(
  input: HrAiDraftInput,
  item: HrIntelligenceItem,
  recommendation: RecommendedAction | null,
): Promise<HrAiDraftResult> {
  const fallback = fallbackDraft(item, recommendation)
  if (!isHrAiEnabled()) {
    return {
      draft: fallback,
      source: 'rule-based',
      available: false,
      message: 'AI drafting is disabled by VITE_AI_ENABLED. Showing the evidence-based draft instead.',
    }
  }
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(HR_DRAFT_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, guardrails: HR_DRAFT_GUARDRAILS }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('AI drafting endpoint unavailable')
    const payload: unknown = await response.json()
    const draft = parseDraft(isRecord(payload) && 'draft' in payload ? payload.draft : payload)
    if (!draft) throw new Error('AI drafting response was invalid')
    return { draft, source: 'ai-assisted', available: true, message: 'AI-assisted draft generated. HR review required.' }
  } catch {
    return {
      draft: fallback,
      source: 'rule-based',
      available: false,
      message: 'AI-assisted draft is unavailable. Showing the evidence-based draft instead.',
    }
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export function getFallbackHrDraft(
  item: HrIntelligenceItem,
  recommendation: RecommendedAction | null,
): HrAiDraftResult {
  return {
    draft: fallbackDraft(item, recommendation),
    source: 'rule-based',
    available: false,
    message: 'Rule-based draft from the existing evidence and recommendation logic.',
  }
}
