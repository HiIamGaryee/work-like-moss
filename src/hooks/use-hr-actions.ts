import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDemoRole } from '@/hooks/use-demo-role'
import { useHrIntelligence } from '@/hooks/use-hr-intelligence'
import { getRoleDivision } from '@/lib/demo-role-config'
import { actionMatchesDivision } from '@/lib/divisions'
import {
  applyActionAssignment,
  applyActionDelivery,
  applyActionStatus,
  createActionFromReview,
  generateActionRecommendations,
} from '@/services/hr-action-recommendation.service'
import {
  clearDemoActionState,
  createDemoActionId,
  isStorageAvailable,
  loadDemoActions,
  loadRecommendationReviews,
  saveDemoActions,
  saveRecommendationReviews,
} from '@/services/hr-action-storage.service'
import type { ActionRecord, HrDataset } from '@/types/hr-data'
import type {
  ActionExecutionStatus,
  ActionAssignmentDraft,
  ActionDeliveryDraft,
  ActionReviewDraft,
  HrAction,
  RecommendationReviewMap,
  RecommendedAction,
} from '@/types/hr-actions'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'

/**
 * The one place the Action Centre's three sources are joined:
 *
 *   generated recommendations  +  local review state  +  approved demo actions
 *
 * Analytics, insights, drivers and priority are reused from the intelligence
 * hook — none of it is recalculated here, and the workbook is never re-parsed.
 * Every localStorage detail stays behind this boundary so no component touches
 * a storage key.
 */

type HrActionsState = {
  data: HrDataset | null
  analytics: HrAnalytics | null
  intelligenceItems: HrIntelligenceItem[]
  topPriorityItems: HrIntelligenceItem[]
  /** Every generated recommendation, carrying its current review status. */
  recommendations: RecommendedAction[]
  /** Approved demo actions, editable and stored locally. */
  activeActions: HrAction[]
  /** Read-only `Action_Tracker` records from the official workbook. */
  officialActions: ActionRecord[]
  /** False when this browser blocks storage; state then lives for the session. */
  storageAvailable: boolean
  isLoading: boolean
  error: string | null
  retry: () => void
  approveAction: (recommendation: RecommendedAction, draft: ActionReviewDraft) => void
  rejectRecommendation: (recommendationId: string, reason?: string) => void
  updateAction: (actionId: string, status: ActionExecutionStatus) => void
  updateActionAssignment: (actionId: string, draft: ActionAssignmentDraft) => void
  updateActionDelivery: (actionId: string, draft: ActionDeliveryDraft) => void
  resetDemo: () => void
}

export function useHrActions(): HrActionsState {
  const { role, division } = useDemoRole()
  const managerDivision = getRoleDivision(role, division)
  const { data, analytics, items, topPriorityItems, isLoading, error, retry } =
    useHrIntelligence()

  const [reviews, setReviews] = useState<RecommendationReviewMap>(loadRecommendationReviews)
  const [demoActions, setDemoActions] = useState<HrAction[]>(loadDemoActions)
  const [storageAvailable] = useState(isStorageAvailable)

  useEffect(() => {
    saveRecommendationReviews(reviews)
  }, [reviews])

  useEffect(() => {
    saveDemoActions(demoActions)
  }, [demoActions])

  const generated = useMemo(
    () => generateActionRecommendations(items, analytics?.priorities ?? []),
    [items, analytics],
  )

  /** Generated recommendations are pure; the review status is layered on top. */
  const recommendations = useMemo(
    () =>
      generated.map((recommendation) => ({
        ...recommendation,
        reviewStatus:
          reviews[recommendation.id]?.status ??
          (demoActions.some((action) => action.sourceRecommendationId === recommendation.id)
            ? 'approved'
            : 'pending-review'),
      })),
    [generated, reviews, demoActions],
  )
  const activeActions = useMemo(
    () => managerDivision
      ? demoActions.filter((action) => actionMatchesDivision(action, managerDivision))
      : demoActions,
    [demoActions, managerDivision],
  )
  const officialActions = useMemo(
    () => {
      const records = analytics?.actions.records ?? []
      return managerDivision
        ? records.filter((action) => actionMatchesDivision(action, managerDivision))
        : records
    }, [analytics, managerDivision],
  )

  const approveAction = useCallback(
    (recommendation: RecommendedAction, draft: ActionReviewDraft) => {
      if (recommendation.reviewStatus !== 'pending-review' ||
          reviews[recommendation.id]?.status === 'approved' ||
          reviews[recommendation.id]?.status === 'rejected') return
      const action = createActionFromReview(
        recommendation,
        draft,
        createDemoActionId(),
        new Date().toISOString(),
      )
      setDemoActions((current) =>
        current.some((entry) => entry.sourceRecommendationId === recommendation.id)
          ? current
          : [action, ...current],
      )
      setReviews((current) => ({
        ...current,
        [recommendation.id]: { status: 'approved', reviewedAt: action.createdAt },
      }))
    },
    [reviews],
  )

  /** A rejected recommendation is marked, never deleted — the decision is data. */
  const rejectRecommendation = useCallback((recommendationId: string, reason?: string) => {
    setReviews((current) =>
      current[recommendationId]
        ? current
        : {
            ...current,
            [recommendationId]: {
              status: 'rejected',
              reviewedAt: new Date().toISOString(),
              ...(reason ? { rejectionReason: reason } : {}),
            },
          },
    )
  }, [])

  const updateAction = useCallback((actionId: string, status: ActionExecutionStatus) => {
    const now = new Date().toISOString()
    setDemoActions((current) =>
      current.map((action) =>
        action.id === actionId ? applyActionStatus(action, status, now) : action,
      ),
    )
  }, [])

  const updateActionAssignment = useCallback((actionId: string, draft: ActionAssignmentDraft) => {
    const now = new Date().toISOString()
    setDemoActions((current) =>
      current.map((action) =>
        action.id === actionId ? applyActionAssignment(action, draft, now) : action,
      ),
    )
  }, [])

  const updateActionDelivery = useCallback((actionId: string, draft: ActionDeliveryDraft) => {
    const now = new Date().toISOString()
    setDemoActions((current) =>
      current.map((action) =>
        action.id === actionId ? applyActionDelivery(action, draft, now) : action,
      ),
    )
  }, [])

  const resetDemo = useCallback(() => {
    clearDemoActionState()
    setReviews({})
    setDemoActions([])
  }, [])

  return {
    data,
    analytics,
    intelligenceItems: items,
    topPriorityItems,
    recommendations,
    activeActions,
    officialActions,
    storageAvailable,
    isLoading,
    error,
    retry,
    approveAction,
    rejectRecommendation,
    updateAction,
    updateActionAssignment,
    updateActionDelivery,
    resetDemo,
  }
}
