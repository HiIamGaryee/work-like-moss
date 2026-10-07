import { useCallback, useEffect, useMemo, useState } from 'react'
import { demoCareProfiles } from '@/data/hr-care-demo'
import { useHrActions } from '@/hooks/use-hr-actions'
import { generateHrAutomations } from '@/services/hr-automation.service'
import { calculateActionImpacts } from '@/services/hr-impact.service'
import {
  clearAutomationState,
  isAutomationStorageAvailable,
  loadAutomationState,
  saveAutomationState,
  type AutomationDemoState,
} from '@/services/hr-automation-storage.service'
import type { HrAction, RecommendedAction } from '@/types/hr-actions'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import type {
  AutomationMessage,
  AutomationSummary,
  AutomationTypeCap,
  FollowUpStatus,
  HrFollowUpItem,
  HrAutomationItem,
} from '@/types/hr-automation'
import { todayIsoDate } from '@/utils/date'

/**
 * The one place automation state is assembled:
 *
 *   official employee data  +  demo care profiles  +  approved demo actions
 *                            +  local handled state
 *
 * The workbook and the approved actions both arrive through `useHrActions`,
 * which already owns them — nothing here re-parses Excel or re-reads the action
 * storage key. Reminders are recalculated when the page loads or when that
 * upstream state changes; there is no scheduler and no background timer.
 */

type HrAutomationsState = {
  /** Every detected reminder, carrying its persisted handled state. */
  automations: HrAutomationItem[]
  activeAutomations: HrAutomationItem[]
  handledAutomations: HrAutomationItem[]
  /** Per-type caps that hid items, so a cap is never silent. */
  caps: AutomationTypeCap[]
  summary: AutomationSummary
  /** Approved demo actions, so the page can link a reminder to its action. */
  demoActions: HrAction[]
  /**
   * Forwarded from the single upstream `useHrActions` instance this hook already
   * holds. A page that needs both reminders and workforce analytics can then
   * mount one hook instead of two, which keeps the intelligence layer to a
   * single computation and the approved-action state to a single copy.
   */
  analytics: HrAnalytics | null
  intelligenceItems: HrIntelligenceItem[]
  topPriorityItems: HrIntelligenceItem[]
  recommendations: RecommendedAction[]
  todayIso: string
  storageAvailable: boolean
  isLoading: boolean
  error: string | null
  retry: () => void
  markHandled: (automationId: string, handled?: boolean) => void
  saveMessageEdit: (automationId: string, message: AutomationMessage) => void
  resetAutomations: () => void
  followUps: HrFollowUpItem[]
  followUpSummary: { open: number; overdue: number; dueSoon: number; completed: number }
  updateFollowUpStatus: (followUpId: string, status: FollowUpStatus) => void
}

/**
 * The engine is deterministic in `now`, so the date is captured once per mount
 * rather than per render — a re-render can never shift "tomorrow" to "today"
 * mid-session.
 */
const captureNow = (): Date => new Date()

export function useHrAutomations(): HrAutomationsState {
  const {
    data,
    analytics,
    activeActions,
    intelligenceItems,
    topPriorityItems,
    recommendations,
    isLoading,
    error,
    retry,
  } =
    useHrActions()
  const [now] = useState(captureNow)
  const [state, setState] = useState<AutomationDemoState>(loadAutomationState)
  const [storageAvailable] = useState(isAutomationStorageAvailable)

  useEffect(() => {
    saveAutomationState(state)
  }, [state])

  /* Reminders wait for the workbook; nothing is invented while it loads. */
  const result = useMemo(
    () => (data ? generateHrAutomations(data, demoCareProfiles, activeActions, now) : null),
    [data, activeActions, now],
  )

  const automations = useMemo(() => {
    if (!result) return []
    const handled = new Set(state.handledIds)
    return result.items.map((item) => ({
      ...item,
      handled: handled.has(item.id),
      ...(state.messageEdits[item.id] ? { messageTemplate: state.messageEdits[item.id] } : {}),
    }))
  }, [result, state])

  const activeAutomations = useMemo(
    () => automations.filter((item) => !item.handled),
    [automations],
  )
  const handledAutomations = useMemo(
    () => automations.filter((item) => item.handled),
    [automations],
  )

  const impactResult = useMemo(
    () => (data && analytics ? calculateActionImpacts(activeActions, data, analytics) : null),
    [data, analytics, activeActions],
  )

  const followUps = useMemo<HrFollowUpItem[]>(() => {
    const statusFor = (id: string, fallback: FollowUpStatus): FollowUpStatus =>
      state.followUpStates[id] ?? fallback
    const automationFollowUps = automations.map<HrFollowUpItem>((item) => {
      const type = item.type === 'onboarding-checkin'
        ? 'onboarding-check-in'
        : item.type === 'action-overdue'
          ? 'overdue-action'
          : item.type === 'action-due'
            ? 'action-review'
            : 'employee-care'
      return {
        id: item.id,
        type,
        title: item.title,
        description: item.description,
        ...(item.actionId ? { relatedActionId: item.actionId } : {}),
        ...(item.employeeContext ? { affectedGroup: item.employeeContext } : {}),
        ...(item.actionOwner ? { owner: item.actionOwner } : {}),
        ...(item.eventDate ? { dueDate: item.eventDate } : {}),
        priority: item.urgency,
        status: statusFor(item.id, item.handled ? 'completed' : 'open'),
        source: 'automation',
        automation: item,
        ...(item.messageTemplate ? { messageReviewAvailable: true } : {}),
        ...(item.linkTo ? { linkTo: item.linkTo, linkLabel: item.linkLabel } : {}),
      }
    })

    const actionFollowUps = activeActions
      .filter((action) => action.status !== 'cancelled')
      .flatMap<HrFollowUpItem>((action) => {
        const delivery = action.delivery
        const items: HrFollowUpItem[] = []
        if (
          delivery &&
          (delivery.status === 'partially-delivered' ||
            (delivery.intendedAudienceCount !== undefined &&
              delivery.reachedAudienceCount !== undefined &&
              delivery.reachedAudienceCount < delivery.intendedAudienceCount))
        ) {
          const id = `delivery-${action.id}-${action.dueDate}`
          items.push({
            id,
            type: 'delivery-follow-up',
            title: `${action.title} delivery follow-up`,
            description: delivery.deliveryNote || 'The intervention has not reached the full intended group yet.',
            relatedActionId: action.id,
            affectedGroup: delivery.affectedGroup || action.affectedScope,
            owner: action.owner,
            dueDate: action.dueDate,
            priority: action.dueDate < todayIsoDate() ? 'overdue' : 'attention',
            status: statusFor(id, 'open'),
            createdAt: action.updatedAt,
            source: 'action',
            linkTo: `/actions?action=${encodeURIComponent(action.id)}`,
            linkLabel: 'Open action',
          })
        }

        const impact = impactResult?.impacts.find((entry) => entry.actionId === action.id)
        if (action.status === 'completed' && delivery?.status === 'delivered' && action.impactMetricKey) {
          const id = `outcome-${action.id}-${action.dueDate}`
          const ready = impact?.measurementStatus === 'measurement-available'
          items.push({
            id,
            type: 'outcome-review',
            title: `${action.title} outcome review`,
            description: ready
              ? 'Comparable follow-up data is available for HR review.'
              : 'Comparable follow-up data is not available yet.',
            relatedActionId: action.id,
            relatedSignalId: action.insightId,
            affectedGroup: action.affectedScope,
            owner: action.owner,
            dueDate: action.dueDate,
            priority: ready ? 'today' : 'upcoming',
            status: statusFor(id, 'open'),
            createdAt: action.completedAt ?? action.updatedAt,
            source: 'impact',
            linkTo: `/impact?action=${encodeURIComponent(action.id)}`,
            linkLabel: 'Review outcome',
          })
        }
        return items
      })

    const recommendationFollowUps = recommendations
      .filter((recommendation) => recommendation.reviewStatus === 'pending-review')
      .map<HrFollowUpItem>((recommendation) => ({
        id: `recommendation-review-${recommendation.id}`,
        type: 'hr-review',
        title: recommendation.title,
        description: 'Recommendation requires HR review before an action can be approved.',
        ...(recommendation.insightId ? { relatedSignalId: recommendation.insightId } : {}),
        affectedGroup: recommendation.affectedScope,
        owner: recommendation.suggestedOwner,
        dueDate: todayIsoDate(),
        priority: recommendation.priorityLevel === 'critical' ? 'overdue' : 'today',
        status: statusFor(`recommendation-review-${recommendation.id}`, 'open'),
        source: 'recommendation',
        linkTo: `/actions?recommendation=${encodeURIComponent(recommendation.id)}`,
        linkLabel: 'Review recommendation',
      }))

    const unique = new Map<string, HrFollowUpItem>()
    ;[...automationFollowUps, ...actionFollowUps, ...recommendationFollowUps].forEach((item) => {
      if (!unique.has(item.id)) unique.set(item.id, item)
    })
    const priorityOrder = { overdue: 0, today: 1, upcoming: 2, attention: 3 }
    return [...unique.values()].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] ||
        (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') ||
        a.title.localeCompare(b.title),
    )
  }, [activeActions, automations, impactResult, recommendations, state.followUpStates])

  const followUpSummary = useMemo(() => ({
    open: followUps.filter((item) => item.status === 'open' || item.status === 'in-progress').length,
    overdue: followUps.filter((item) => item.status !== 'completed' && item.status !== 'dismissed' && item.priority === 'overdue').length,
    dueSoon: followUps.filter((item) => item.status !== 'completed' && item.status !== 'dismissed' && (item.priority === 'today' || item.priority === 'upcoming')).length,
    completed: followUps.filter((item) => item.status === 'completed' || item.status === 'dismissed').length,
  }), [followUps])

  const summary = useMemo<AutomationSummary>(
    () => ({
      needsAttention: activeAutomations.length,
      dueToday: activeAutomations.filter((item) => item.urgency === 'today').length,
      upcoming: activeAutomations.filter((item) => item.urgency === 'upcoming').length,
      overdue: activeAutomations.filter((item) => item.urgency === 'overdue').length,
      handled: handledAutomations.length,
    }),
    [activeAutomations, handledAutomations],
  )

  /**
   * Handling records an acknowledgement and nothing else. It does not mark a
   * message as sent — the app cannot know that — and it does not alter the
   * employee record or the action the reminder came from.
   */
  const markHandled = useCallback((automationId: string, handled = true) => {
    setState((current) => {
      const ids = new Set(current.handledIds)
      if (handled) ids.add(automationId)
      else ids.delete(automationId)
      return {
        ...current,
        handledIds: [...ids],
        followUpStates: {
          ...current.followUpStates,
          [automationId]: handled ? 'completed' : 'open',
        },
      }
    })
  }, [])

  const updateFollowUpStatus = useCallback((followUpId: string, status: FollowUpStatus) => {
    setState((current) => ({
      ...current,
      followUpStates: { ...current.followUpStates, [followUpId]: status },
    }))
  }, [])

  const saveMessageEdit = useCallback((automationId: string, message: AutomationMessage) => {
    setState((current) => ({
      ...current,
      messageEdits: { ...current.messageEdits, [automationId]: message },
    }))
  }, [])

  /** Clears reminder state only; approved demo actions are left untouched. */
  const resetAutomations = useCallback(() => {
    clearAutomationState()
    setState({ handledIds: [], messageEdits: {}, followUpStates: {} })
  }, [])

  return {
    automations,
    activeAutomations,
    handledAutomations,
    caps: result?.caps ?? [],
    summary,
    demoActions: activeActions,
    analytics,
    intelligenceItems,
    topPriorityItems,
    recommendations,
    todayIso: todayIsoDate(),
    storageAvailable,
    isLoading,
    error,
    retry,
    markHandled,
    saveMessageEdit,
    resetAutomations,
    followUps,
    followUpSummary,
    updateFollowUpStatus,
  }
}
