import { useMemo } from 'react'
import { useHrActions } from '@/hooks/use-hr-actions'
import { calculateActionImpacts } from '@/services/hr-impact.service'
import type { ActionImpact, ImpactSummary } from '@/types/hr-impact'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrAction, RecommendedAction } from '@/types/hr-actions'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'

/**
 * The measure stage, assembled from sources that already exist:
 *
 *   useHrData → useHrAnalytics → useHrIntelligence → useHrActions → useHrImpact
 *
 * The workbook is parsed once by the cached loader beneath this chain, analytics
 * and intelligence are memoised upstream, and approved actions come from the one
 * hook that owns them. Nothing is re-parsed and nothing is re-derived here.
 *
 * Impact is calculated, never stored: an `ActionImpact` is a pure function of
 * the approved action plus the official dataset, so it is always consistent with
 * both and localStorage stays limited to operational demo state.
 */

type HrImpactState = {
  impacts: ActionImpact[]
  measuredImpacts: ActionImpact[]
  awaitingMeasurement: ActionImpact[]
  summary: ImpactSummary
  /**
   * Forwarded from the single upstream `useHrActions` instance. A page that
   * needs the whole chain — insight, recommendation, action, measurement — then
   * mounts one hook instead of two, keeping the intelligence layer to a single
   * computation and the approved-action state to a single copy.
   */
  demoActions: HrAction[]
  analytics: HrAnalytics | null
  recommendations: RecommendedAction[]
  intelligenceItems: HrIntelligenceItem[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

const EMPTY_SUMMARY: ImpactSummary = {
  actionsTracked: 0,
  completedActions: 0,
  measurementsAvailable: 0,
  improved: 0,
  declined: 0,
  noClearChange: 0,
  targetsMet: 0,
  partiallyMet: 0,
  notMet: 0,
  awaitingMeasurement: 0,
  notComparable: 0,
  targetAchievementRate: null,
}

export function useHrImpact(): HrImpactState {
  const {
    data,
    analytics,
    activeActions,
    recommendations,
    intelligenceItems,
    isLoading,
    error,
    retry,
  } = useHrActions()

  /* Measurement waits for the workbook; nothing is estimated while it loads. */
  const result = useMemo(
    () => (data && analytics ? calculateActionImpacts(activeActions, data, analytics) : null),
    [data, analytics, activeActions],
  )

  const impacts = result?.impacts ?? []

  return {
    impacts,
    measuredImpacts: impacts.filter(
      (impact) => impact.measurementStatus === 'measurement-available',
    ),
    awaitingMeasurement: impacts.filter(
      (impact) => impact.measurementStatus === 'awaiting-measurement',
    ),
    summary: result?.summary ?? EMPTY_SUMMARY,
    demoActions: activeActions,
    analytics,
    recommendations,
    intelligenceItems,
    isLoading,
    error,
    retry,
  }
}
