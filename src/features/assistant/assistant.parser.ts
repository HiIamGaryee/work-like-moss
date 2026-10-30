import { DIVISION_METRICS, QUESTION_INTENTS } from '@/features/assistant/assistant.config'
import type { AssistantContext, AssistantIntent, ParsedQuestion } from '@/features/assistant/assistant.types'
import type { HrAnalytics } from '@/types/hr-analytics'

type ParseQuestionInput = {
  question: string
  analytics: HrAnalytics
  context: AssistantContext
}

export function normaliseQuestion(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function phraseScore(question: string, phrase: string): number {
  const normalisedPhrase = normaliseQuestion(phrase)
  const phraseWords = normalisedPhrase.split(' ')
  if (question === normalisedPhrase) return 1
  if (question.includes(normalisedPhrase)) return Math.min(0.98, 0.72 + phraseWords.length * 0.04)
  const questionWords = new Set(question.split(' '))
  const overlap = phraseWords.filter((word) => questionWords.has(word)).length
  return overlap >= 2 ? Math.min(0.7, overlap / phraseWords.length) : 0
}

function matchIntent(question: string): { intent: AssistantIntent; confidence: number } {
  const normalisedQuestion = normaliseQuestion(question)
  let bestIntent: AssistantIntent = 'unknown'
  let confidence = 0

  QUESTION_INTENTS.forEach(({ intent, phrases }) => {
    const score = Math.max(...phrases.map((phrase) => phraseScore(normalisedQuestion, phrase)))
    if (score > confidence) {
      bestIntent = intent
      confidence = score
    }
  })

  return { intent: bestIntent, confidence }
}

function findNamedValue(question: string, values: string[]): string | undefined {
  const normalisedQuestion = normaliseQuestion(question)
  const words = normalisedQuestion.split(' ')
  return values.find((value) => {
    const normalisedValue = normaliseQuestion(value)
    if (normalisedQuestion.includes(normalisedValue)) return true
    return words.some((word) => word.length >= 4 && normalisedValue.startsWith(word))
  })
}

function findMetricId(question: string): string | undefined {
  const normalisedQuestion = normaliseQuestion(question)
  return DIVISION_METRICS.find(({ aliases }) =>
    aliases.some((alias) => normalisedQuestion.includes(normaliseQuestion(alias))),
  )?.id
}

export function parseQuestion({ question, analytics, context }: ParseQuestionInput): ParsedQuestion {
  const normalised = normaliseQuestion(question)
  const matched = matchIntent(question)
  const division = findNamedValue(question, analytics.divisions.map(({ division }) => division))
  const employeeGroup = findNamedValue(question, analytics.employeeGroups.map(({ group }) => group))
  const metricId = findMetricId(question)
  const contextualIntents: AssistantIntent[] = [
    'division_evidence',
    'linked_action',
    'linked_impact',
    'why_matters',
    'show_number',
  ]

  if (contextualIntents.includes(matched.intent)) {
    return {
      intent: matched.intent,
      division: division ?? context.lastDivision,
      employeeGroup: employeeGroup ?? context.lastEmployeeGroup,
      metricId,
      confidence: matched.confidence,
    }
  }

  if (employeeGroup) {
    return { intent: 'employee_group_summary', employeeGroup, metricId, confidence: 0.95 }
  }

  if (
    context.lastDivision
    && metricId
    && !/\b(?:company|overall|organisation|organization)\b/.test(normalised)
    && ['engagement', 'technology_access', 'unknown'].includes(matched.intent)
  ) {
    return {
      intent: 'division_metric',
      division: context.lastDivision,
      metricId,
      confidence: Math.max(0.9, matched.confidence),
    }
  }

  if (
    context.lastDivision
    && matched.intent === 'unknown'
    && /\b(?:this|selected)\s+(?:department|division)\b/.test(normalised)
  ) {
    return { intent: 'division_summary', division: context.lastDivision, confidence: 0.9 }
  }

  if (division && matched.intent === 'division_comparison') {
    return { intent: 'division_comparison', division, metricId: metricId ?? 'engagement', confidence: 0.98 }
  }

  if (division && metricId) {
    return { intent: 'division_metric', division, metricId, confidence: 0.98 }
  }

  if (division) {
    return { intent: 'division_summary', division, confidence: 0.95 }
  }

  if (metricId && matched.intent === 'unknown') {
    return { intent: metricId === 'tools_access' ? 'technology_access' : 'engagement', metricId, confidence: 0.7 }
  }

  return { ...matched, metricId }
}
