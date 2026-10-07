import { useCallback, useEffect, useMemo, useState } from 'react'
import { demoCareProfiles } from '@/data/hr-care-demo'
import { useHrActions } from '@/hooks/use-hr-actions'
import { generateHrAutomations } from '@/services/hr-automation.service'
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
      return { ...current, handledIds: [...ids] }
    })
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
    setState({ handledIds: [], messageEdits: {} })
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
  }
}
