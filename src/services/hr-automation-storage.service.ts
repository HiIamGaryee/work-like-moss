import type { AutomationMessage } from '@/types/hr-automation'

/**
 * Local persistence for automation demo state only.
 *
 * What is stored: which reminders HR has acknowledged, and any edits made to a
 * suggested message. That is all the workflow needs.
 *
 * What is never stored: the Excel dataset, employee records, join dates,
 * official actions, or anything derived from the analytics layer. Marking a
 * reminder handled records that *HR acknowledged an event* — it does not touch
 * the source data the reminder was calculated from, so a refresh recalculates
 * every reminder from the workbook exactly as before.
 *
 * Nothing read back is trusted: a person can edit browser storage, so malformed
 * JSON or a bad entry drops that entry rather than throwing.
 */

export const HR_AUTOMATION_STORAGE_KEY = 'work-like-moss:hr-automation:v1'

export interface AutomationDemoState {
  /** Ids of reminders HR has acknowledged. */
  handledIds: string[]
  /** Reviewer edits to a suggested message, keyed by reminder id. */
  messageEdits: Record<string, AutomationMessage>
}

export const EMPTY_AUTOMATION_STATE: AutomationDemoState = { handledIds: [], messageEdits: {} }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string => typeof value === 'string'

function parseMessage(value: unknown): AutomationMessage | null {
  if (!isRecord(value) || !isText(value.body)) return null
  return {
    body: value.body,
    ...(isText(value.subject) ? { subject: value.subject } : {}),
  }
}

/** `false` means the write did not happen — the caller keeps in-memory state. */
export function isAutomationStorageAvailable(): boolean {
  const probeKey = `${HR_AUTOMATION_STORAGE_KEY}:probe`
  try {
    globalThis.localStorage?.setItem(probeKey, '1')
    globalThis.localStorage?.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

/** A corrupt payload falls back to an empty demo state rather than crashing. */
export function loadAutomationState(): AutomationDemoState {
  let parsed: unknown
  try {
    const raw = globalThis.localStorage?.getItem(HR_AUTOMATION_STORAGE_KEY)
    parsed = raw === null || raw === undefined ? null : JSON.parse(raw)
  } catch {
    return EMPTY_AUTOMATION_STATE
  }

  if (!isRecord(parsed)) return EMPTY_AUTOMATION_STATE

  const handledIds = Array.isArray(parsed.handledIds)
    ? [...new Set(parsed.handledIds.filter((id): id is string => isText(id) && id.trim() !== ''))]
    : []

  const messageEdits = isRecord(parsed.messageEdits)
    ? Object.entries(parsed.messageEdits).reduce<Record<string, AutomationMessage>>(
        (edits, [id, value]) => {
          const message = parseMessage(value)
          if (message) edits[id] = message
          return edits
        },
        {},
      )
    : {}

  return { handledIds, messageEdits }
}

export function saveAutomationState(state: AutomationDemoState): boolean {
  try {
    globalThis.localStorage?.setItem(HR_AUTOMATION_STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

/**
 * Clears automation demo state only. Approved demo actions from the Action
 * Centre live under their own key and are deliberately left alone — resetting
 * reminders must not delete work HR approved.
 */
export function clearAutomationState(): void {
  try {
    globalThis.localStorage?.removeItem(HR_AUTOMATION_STORAGE_KEY)
  } catch {
    /* Storage is unavailable; the caller still resets its in-memory state. */
  }
}
