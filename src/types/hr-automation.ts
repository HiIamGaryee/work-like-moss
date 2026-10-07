/**
 * HR care automation.
 *
 * An automation item is a *reminder for a person*, never an instruction to a
 * machine. Nothing in this model can send, schedule, or decide: it carries the
 * event the system noticed, the context behind it, and a suggested message that
 * a human reads, edits and chooses to use.
 *
 * Three rules hold throughout:
 *  1. `source` always says where the facts came from, so clearly-labelled demo
 *     care data is never mistaken for the official workbook.
 *  2. `audience` separates an internal HR reminder from an employee-facing
 *     message, so HR analytics can never leak into a birthday wish.
 *  3. There is no risk, loyalty or flight-probability field, and there never
 *     should be. This feature is about timely care, not surveillance.
 */

export type CareChannel = 'email' | 'whatsapp' | 'none'

export type AutomationType =
  | 'birthday'
  | 'work-anniversary'
  | 'onboarding-checkin'
  | 'manager-checkin'
  | 'compensation-review'
  | 'recognition'
  | 'action-due'
  | 'action-overdue'

export type AutomationUrgency = 'today' | 'upcoming' | 'overdue' | 'attention'

export type FollowUpType =
  | 'employee-care'
  | 'onboarding-check-in'
  | 'action-review'
  | 'overdue-action'
  | 'delivery-follow-up'
  | 'hr-review'
  | 'message-review'
  | 'outcome-review'

export type FollowUpStatus = 'open' | 'in-progress' | 'completed' | 'dismissed'

export type FollowUpSource = 'automation' | 'action' | 'recommendation' | 'impact'

/** Which facts a reminder rests on, shown to the reader as a badge. */
export type AutomationSource = 'official-dataset' | 'demo-extension' | 'local-action'

/** Who a suggested message is written for. Internal text never reaches employees. */
export type MessageAudience = 'employee' | 'internal'

export interface AutomationMessage {
  subject?: string
  body: string
}

/**
 * Care information a real HRIS might hold in future. It is DEMO EXTENSION DATA
 * and is not part of Glocomp's official workbook.
 *
 * Deliberately absent: birth year, age, marital status, family, health,
 * religion, ethnicity, politics. A birthday reminder needs a month and a day —
 * nothing else — so nothing else is stored.
 */
export interface EmployeeCareProfile {
  employeeId: string
  /** Synthetic display name; the official dataset carries no employee names. */
  displayName: string

  birthdayMonth?: number
  birthdayDay?: number

  /**
   * Prototype demonstration value only. Production use would require recorded
   * communication preferences and explicit employee consent.
   */
  preferredChannel?: CareChannel

  lastManagerCheckinDate?: string | null
  lastCompensationReviewDate?: string | null
  lastRecognitionDate?: string | null
}

export interface HrAutomationItem {
  id: string
  type: AutomationType

  title: string
  description: string
  /** Plain-language statement of the rule that surfaced this reminder. */
  reason: string

  employeeId?: string
  employeeName?: string
  /** Official division and group, when the employee is in the workbook. */
  employeeContext?: string

  actionId?: string
  /** Role accountable for an action reminder, carried over from the action. */
  actionOwner?: string

  /** The calendar date the reminder is about, when the event has one. */
  eventDate?: string
  /** Signed days from today to `eventDate`; negative when it has passed. */
  daysUntilEvent?: number

  urgency: AutomationUrgency

  suggestedAction: string

  preferredChannel?: CareChannel

  messageTemplate?: AutomationMessage
  messageAudience?: MessageAudience

  /** In-app destination for reminders that are reviewed rather than messaged. */
  linkTo?: string
  linkLabel?: string

  sources: AutomationSource[]

  handled: boolean
}

/** Counts driving the page summary, all derived from the live item list. */
export interface AutomationSummary {
  needsAttention: number
  dueToday: number
  upcoming: number
  overdue: number
  handled: number
}

/** Reported when a per-type cap hid items, so a cap is never silent. */
export interface AutomationTypeCap {
  type: AutomationType
  shown: number
  detected: number
}

export interface HrFollowUpItem {
  id: string
  type: FollowUpType
  title: string
  description: string
  relatedSignalId?: string
  relatedActionId?: string
  affectedGroup?: string
  owner?: string
  dueDate?: string
  priority: AutomationUrgency
  status: FollowUpStatus
  createdAt?: string
  completedAt?: string
  source: FollowUpSource
  automation?: HrAutomationItem
  messageReviewAvailable?: boolean
  linkTo?: string
  linkLabel?: string
}

export interface HrAutomationResult {
  items: HrAutomationItem[]
  caps: AutomationTypeCap[]
}
