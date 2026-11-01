import { MIN_ANALYSIS_SAMPLE_SIZE } from '@/data/hr-analytics.constants'
import { TREND_FLAT_BAND } from '@/data/hr-priority-rules'
import type { RecommendedAction } from '@/types/hr-actions'
import type { EvidenceStrength, HrAnalytics, PriorityIssue } from '@/types/hr-analytics'
import { formatDelta } from '@/utils/format'
import { canShowGroupDetail } from '@/utils/insight-privacy'

/**
 * Selection and wording only. Every number here was already produced by the
 * Step 4 priority issue or the pulse analytics; nothing is recalculated.
 */

export type SignalUnit = 'score' | 'percentage'
export type TrendDirection = 'improving' | 'declining' | 'stable'

export type RecommendationSignal = {
  scopeName: string
  unit: SignalUnit
  observed: number
  benchmark: number | null
  benchmarkLabel: string
  gapText: string | null
  sampleSize: number
  isSmallSample: boolean
  keySignal: string
  trend: { points: { wave: string; value: number }[]; direction: TrendDirection } | null
  factors: { key: string; label: string; score: number; reason: string }[]
  strength: EvidenceStrength
  supporting: { label: string; gapText: string | null; strength: EvidenceStrength | null } | null
}

const FACTORS = [
  { key: 'severity', label: 'Severity' },
  { key: 'reach', label: 'Reach' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'urgency', label: 'Urgency' },
] as const

const signedGap = (value: number | null, unit: SignalUnit, reference: string): string | null =>
  value === null
    ? null
    : unit === 'percentage'
      ? `${formatDelta(value, 1)} pts vs ${reference}`
      : `${formatDelta(value)} vs ${reference}`

function pulseTrend(issue: PriorityIssue, analytics: HrAnalytics): RecommendationSignal['trend'] {
  if (issue.metric !== 'pulse_engagement' && issue.metric !== 'pulse_engagement_change') return null

  const series =
    issue.scopeType === 'company'
      ? analytics.pulse.trend
      : (issue.scopeType === 'division'
          ? analytics.pulse.byDivision
          : analytics.pulse.byEmployeeGroup
        ).find((group) => group.group === issue.scopeName)?.trend ?? []

  const points = series
    .filter((point) => canShowGroupDetail(point.responseCount) && point.engagement !== null)
    .slice(-5)
    .map((point) => ({ wave: point.wave, value: point.engagement ?? 0 }))
  if (points.length < 2) return null

  const change = (points[points.length - 1]?.value ?? 0) - (points[0]?.value ?? 0)
  const direction: TrendDirection =
    Math.abs(change) < TREND_FLAT_BAND ? 'stable' : change > 0 ? 'improving' : 'declining'
  return { points, direction }
}

export function getRecommendationSignal(
  recommendation: RecommendedAction,
  analytics: HrAnalytics | null,
): RecommendationSignal | null {
  const issue = analytics?.priorities.find((entry) => entry.id === recommendation.issueId)
  if (!analytics || !issue || issue.observedValue === null) return null

  const unit: SignalUnit = issue.metric === 'leaver_rate' ? 'percentage' : 'score'
  const benchmarkLabel = issue.metric === 'pulse_engagement_change' ? 'previous wave' : 'company'

  const candidate = recommendation.driverCategory === 'diagnostic'
    ? undefined
    : issue.supportingEvidence?.driverCandidates.find(
        (entry) => entry.label === recommendation.driverLabel,
      )
  const driverItem = candidate?.evidenceItems.find(
    (item) => item.difference !== null && item.groupValue !== null,
  )

  return {
    scopeName: issue.scopeName,
    unit,
    observed: issue.observedValue,
    benchmark: issue.benchmarkValue,
    benchmarkLabel,
    gapText: signedGap(issue.difference, unit, benchmarkLabel),
    sampleSize: issue.sampleSize,
    isSmallSample: issue.sampleSize < MIN_ANALYSIS_SAMPLE_SIZE,
    keySignal: issue.breakdown.severity.reason,
    trend: pulseTrend(issue, analytics),
    factors: FACTORS.flatMap(({ key, label }) => {
      const score = issue.breakdown[key].score
      return score === null ? [] : [{ key, label, score, reason: issue.breakdown[key].reason }]
    }),
    strength: issue.evidenceStrength,
    supporting: recommendation.driverCategory === 'diagnostic'
      ? null
      : {
          label: recommendation.driverLabel,
          gapText: driverItem
            ? signedGap(driverItem.difference, driverItem.unit === 'percentage' ? 'percentage' : 'score', 'company')
            : null,
          strength: candidate?.strength ?? null,
        },
  }
}
