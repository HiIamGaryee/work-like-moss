import type {
  ActionExecutionStatus,
  HrAction,
} from '@/types/hr-actions'
import type {
  AutomationSource,
  AutomationType,
  AutomationUrgency,
  CareChannel,
} from '@/types/hr-automation'
import { daysBetween } from '@/utils/date'

/**
 * Developer note — what these rules are, and what they are not
 *
 * These are PROTOTYPE AUTOMATION RULES for a hackathon demo: round numbers that
 * show the reminder engine working and can be read at a glance. They are NOT
 * Glocomp HR policy, contractual review cycles, or validated best practice. A
 * real deployment would set them from its own people policy.
 *
 * Every threshold lives here so recalibration is a one-file change and no
 * magic number is scattered through the automation service or the UI.
 */
export const HR_AUTOMATION_RULES = {
  /** Birthdays surface this many days ahead; 1 means today and tomorrow. */
  birthdayReminderDays: 1,
  /** Work anniversaries surface this many days ahead. */
  anniversaryReminderDays: 7,

  /** Days-since-joining milestones for the new joiner check-in. */
  onboardingMilestones: [30, 60, 90],
  /**
   * How close to a milestone a reminder may appear, in days either side. Kept
   * deliberately tight: a Day 30 prompt shown to someone on Day 180 is noise,
   * not care.
   */
  onboardingMilestoneWindowDays: 2,

  /** A recorded manager check-in older than this is due again. */
  managerCheckinOverdueDays: 45,

  /** A recorded compensation review older than this is due again. */
  compensationReviewMonths: 12,

  /** A recorded recognition older than this prompts a review. */
  recognitionReminderDays: 90,

  /** Approved actions surface this many days before their due date. */
  actionDueReminderDays: 7,
  /** Days overdue at which escalation is recommended. */
  actionEscalationDays: 7,
  /** Days overdue at which a second owner reminder is suggested. */
  actionSecondReminderDays: 3,

  /** Per-type display cap, so one busy rule cannot flood the inbox. */
  maxItemsPerType: 4,
} as const

export const AUTOMATION_RULES_NOTE =
  'Prototype automation rules, not Glocomp HR policy. Reminders are calculated in the browser when the page loads; nothing is scheduled and nothing is sent automatically.'

/** The plain-language rule summary shown in "How reminders work". */
export const AUTOMATION_RULE_SUMMARY = [
  { label: 'Birthday', value: '1 day before' },
  { label: 'Work anniversary', value: '7 days before' },
  { label: 'Onboarding check-in', value: 'Day 30 / 60 / 90 (±2 days)' },
  { label: 'Manager check-in', value: 'No record for 45 days' },
  { label: 'Compensation review', value: 'No record for 12 months' },
  { label: 'Recognition', value: 'No record for 90 days' },
  { label: 'Action due', value: '7 days before the deadline' },
  { label: 'Action escalation', value: '7 days past the deadline' },
] as const

export const AUTOMATION_TYPE_LABELS: Record<AutomationType, string> = {
  birthday: 'Birthday',
  'work-anniversary': 'Work anniversary',
  'onboarding-checkin': 'Onboarding check-in',
  'manager-checkin': 'Manager check-in',
  'compensation-review': 'Compensation review',
  recognition: 'Recognition',
  'action-due': 'Action due',
  'action-overdue': 'Action overdue',
}

export const AUTOMATION_URGENCY_LABELS: Record<AutomationUrgency, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  attention: 'Attention',
}

export const AUTOMATION_SOURCE_LABELS: Record<AutomationSource, string> = {
  'official-dataset': 'Official Dataset',
  'demo-extension': 'Demo Extension',
  'local-action': 'Local Action',
}

export const CARE_CHANNEL_LABELS: Record<CareChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  none: 'No preferred channel',
}

/** UI grouping only — several automation types share one category filter. */
export const AUTOMATION_CATEGORIES = [
  { key: 'all', label: 'All categories', types: null },
  {
    key: 'employee-care',
    label: 'Employee Care',
    types: ['birthday', 'work-anniversary', 'recognition', 'compensation-review'],
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    types: ['onboarding-checkin', 'manager-checkin'],
  },
  { key: 'actions', label: 'Actions', types: ['action-due', 'action-overdue'] },
] as const satisfies readonly {
  key: string
  label: string
  types: readonly AutomationType[] | null
}[]

export type AutomationCategoryKey = (typeof AUTOMATION_CATEGORIES)[number]['key']

/**
 * The section's stated order: overdue first, then what is happening today,
 * then what is coming, then standing items with no fixed date.
 */
export const AUTOMATION_URGENCY_ORDER: Record<AutomationUrgency, number> = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  attention: 3,
}

/**
 * Tie-break inside one urgency bucket: a missed commitment outranks a standing
 * fairness review, which outranks a gesture of appreciation.
 */
export const AUTOMATION_TYPE_ORDER: Record<AutomationType, number> = {
  'action-overdue': 0,
  'compensation-review': 1,
  'manager-checkin': 2,
  'action-due': 3,
  'onboarding-checkin': 4,
  recognition: 5,
  birthday: 6,
  'work-anniversary': 7,
}

/* ------------------------------------------------- shared action reminders */

export type ActionReminderState = 'due-soon' | 'overdue' | 'escalate'

/**
 * The single definition of when an approved action needs a nudge, shared by the
 * automation engine and the Action Centre so the two can never disagree about
 * whether a deadline is close. Completed and cancelled actions are never
 * chased.
 */
export function classifyActionReminder(
  dueDate: string,
  status: ActionExecutionStatus,
  todayIso: string,
): ActionReminderState | null {
  if (status === 'completed' || status === 'cancelled') return null

  const days = daysBetween(todayIso, dueDate)
  if (days === null) return null

  if (days < 0) {
    return Math.abs(days) >= HR_AUTOMATION_RULES.actionEscalationDays ? 'escalate' : 'overdue'
  }
  return days <= HR_AUTOMATION_RULES.actionDueReminderDays ? 'due-soon' : null
}

export const ACTION_REMINDER_LABELS: Record<ActionReminderState, string> = {
  'due-soon': 'Due soon',
  overdue: 'Reminder active',
  escalate: 'Escalation recommended',
}

export const actionReminderState = (
  action: HrAction,
  todayIso: string,
): ActionReminderState | null => classifyActionReminder(action.dueDate, action.status, todayIso)
