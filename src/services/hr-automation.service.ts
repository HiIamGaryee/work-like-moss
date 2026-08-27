import { demoCareProfiles } from '@/data/hr-care-demo'
import {
  AUTOMATION_TYPE_ORDER,
  AUTOMATION_URGENCY_ORDER,
  HR_AUTOMATION_RULES,
  classifyActionReminder,
} from '@/data/hr-automation-rules'
import {
  createActionReminder,
  createAnniversaryMessage,
  createBirthdayMessage,
  createEscalationReminder,
  createManagerReminder,
  createOnboardingMessage,
} from '@/data/hr-message-templates'
import type { HrAction } from '@/types/hr-actions'
import type {
  AutomationType,
  AutomationTypeCap,
  EmployeeCareProfile,
  HrAutomationItem,
  HrAutomationResult,
} from '@/types/hr-automation'
import type { Employee, HrDataset } from '@/types/hr-data'
import {
  addDays,
  daysBetween,
  monthsBetween,
  nextAnniversary,
  nextOccurrence,
  toIsoDate,
} from '@/utils/date'

/**
 * The HR care automation engine.
 *
 *   employee lifecycle facts  +  demo care records  +  approved actions
 *                                   ↓
 *                     "what is easy to forget today"
 *
 * Three properties hold by construction:
 *
 *  1. **Deterministic in `now`.** The current date enters once, at the top, and
 *     is threaded through every rule as a calendar-day string. No helper reads
 *     the clock, so the same inputs always produce the same reminders — which is
 *     what makes the rules testable at any date.
 *  2. **Suggestions only.** Every item is a prompt for a person. Nothing here
 *     sends, schedules or records a communication.
 *  3. **No scoring of people.** There is no risk, loyalty or attrition estimate
 *     anywhere in this file, and no inference from what an employee has *not*
 *     asked for. A missing record means "review this", never "they must be fine".
 */

const {
  birthdayReminderDays,
  anniversaryReminderDays,
  onboardingMilestones,
  onboardingMilestoneWindowDays,
  managerCheckinOverdueDays,
  compensationReviewMonths,
  recognitionReminderDays,
  actionDueReminderDays,
  actionEscalationDays,
  actionSecondReminderDays,
  maxItemsPerType,
} = HR_AUTOMATION_RULES

/** Context passed to every detector, so none of them reads the clock. */
type DetectionContext = {
  todayIso: string
  employeesById: Map<string, Employee>
  profiles: readonly EmployeeCareProfile[]
}

const employeeContextOf = (employee: Employee | undefined): string | undefined =>
  employee ? `${employee.division} · ${employee.employeeGroup}` : undefined

/** Reminders are about people who are still here. */
const isActive = (employee: Employee | undefined): boolean => employee?.exitStatus === 'Active'

/* ------------------------------------------------------------- birthdays */

/**
 * Birthday today or tomorrow. Only a month and a day are read — the extension
 * stores no birth year, so no age can be derived even by accident.
 */
function detectBirthdays({ todayIso, employeesById, profiles }: DetectionContext): HrAutomationItem[] {
  return profiles.flatMap<HrAutomationItem>((profile) => {
    const { birthdayMonth, birthdayDay } = profile
    if (birthdayMonth === undefined || birthdayDay === undefined) return []

    const employee = employeesById.get(profile.employeeId)
    if (!isActive(employee)) return []

    /* Invalid demo data yields no reminder rather than an exception. */
    const eventDate = nextOccurrence(birthdayMonth, birthdayDay, todayIso)
    if (!eventDate) return []

    const days = daysBetween(todayIso, eventDate)
    if (days === null || days > birthdayReminderDays) return []

    const when = days === 0 ? 'today' : 'tomorrow'
    return [
      {
        id: `birthday-${profile.employeeId}-${eventDate.slice(0, 4)}`,
        type: 'birthday',
        title: `Birthday ${when}`,
        description: `${profile.displayName}'s birthday is ${when}.`,
        reason: `Birthdays surface ${birthdayReminderDays} day before the date.`,
        employeeId: profile.employeeId,
        employeeName: profile.displayName,
        employeeContext: employeeContextOf(employee),
        eventDate,
        daysUntilEvent: days,
        urgency: days === 0 ? 'today' : 'upcoming',
        suggestedAction: 'Send a short appreciation message.',
        preferredChannel: profile.preferredChannel,
        messageTemplate: createBirthdayMessage(profile.displayName),
        messageAudience: 'employee',
        sources: ['demo-extension'],
        handled: false,
      },
    ]
  })
}

/* --------------------------------------------------------- anniversaries */

/**
 * Work anniversaries come from the official `joinDate`, so this rule runs
 * against the whole workbook rather than only the demo profiles. A care profile
 * adds a name when one exists; without it the reminder still stands on official
 * data and shows the employee ID.
 */
function detectWorkAnniversaries({
  todayIso,
  employeesById,
  profiles,
}: DetectionContext): HrAutomationItem[] {
  const profilesById = new Map(profiles.map((profile) => [profile.employeeId, profile]))

  return [...employeesById.values()].flatMap<HrAutomationItem>((employee) => {
    if (!isActive(employee)) return []

    const anniversary = nextAnniversary(employee.joinDate, todayIso)
    if (!anniversary) return []

    const days = daysBetween(todayIso, anniversary.date)
    if (days === null || days > anniversaryReminderDays) return []

    const profile = profilesById.get(employee.employeeId)
    const name = profile?.displayName ?? employee.employeeId
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`

    return [
      {
        id: `anniversary-${employee.employeeId}-${anniversary.years}`,
        type: 'work-anniversary',
        title: `${anniversary.years}-year work anniversary`,
        description: `${name} reaches ${anniversary.years} ${anniversary.years === 1 ? 'year' : 'years'} with the company ${when}.`,
        reason: `Calculated from the official join date of ${employee.joinDate}; anniversaries surface ${anniversaryReminderDays} days ahead.`,
        employeeId: employee.employeeId,
        ...(profile ? { employeeName: profile.displayName } : {}),
        employeeContext: employeeContextOf(employee),
        eventDate: anniversary.date,
        daysUntilEvent: days,
        urgency: days === 0 ? 'today' : 'upcoming',
        suggestedAction: 'Send appreciation, notify the manager, and consider recognition.',
        preferredChannel: profile?.preferredChannel,
        /* Without a name there is nobody to address, so no draft is offered. */
        ...(profile
          ? {
              messageTemplate: createAnniversaryMessage(profile.displayName, anniversary.years),
              messageAudience: 'employee' as const,
            }
          : {}),
        sources: profile ? ['official-dataset', 'demo-extension'] : ['official-dataset'],
        handled: false,
      },
    ]
  })
}

/* ------------------------------------------------------------- onboarding */

/**
 * Day 30 / 60 / 90 check-ins, measured from the official `joinDate`. The window
 * is deliberately narrow: a Day 30 prompt is only useful around Day 30, so
 * someone at Day 180 is never shown one.
 */
function detectOnboardingMilestones({
  todayIso,
  employeesById,
  profiles,
}: DetectionContext): HrAutomationItem[] {
  const profilesById = new Map(profiles.map((profile) => [profile.employeeId, profile]))

  return [...employeesById.values()].flatMap<HrAutomationItem>((employee) => {
    if (!isActive(employee)) return []

    const daysSinceJoining = daysBetween(employee.joinDate, todayIso)
    if (daysSinceJoining === null || daysSinceJoining < 0) return []

    const milestone = onboardingMilestones.find(
      (day) => Math.abs(daysSinceJoining - day) <= onboardingMilestoneWindowDays,
    )
    if (milestone === undefined) return []

    const profile = profilesById.get(employee.employeeId)
    const name = profile?.displayName ?? employee.employeeId
    /* Positive once the milestone has passed. */
    const offset = daysSinceJoining - milestone
    /* The reminder is about the milestone day, not the day they joined. */
    const milestoneDate = addDays(employee.joinDate, milestone)

    return [
      {
        id: `onboarding-${employee.employeeId}-day${milestone}`,
        type: 'onboarding-checkin',
        title: `${milestone}-day new joiner check-in`,
        description: `${name} has been with the company for ${daysSinceJoining} days.`,
        reason: `Day ${milestone} milestone, measured from the official join date of ${employee.joinDate} (±${onboardingMilestoneWindowDays} days).`,
        employeeId: employee.employeeId,
        ...(profile ? { employeeName: profile.displayName } : {}),
        employeeContext: employeeContextOf(employee),
        eventDate: milestoneDate,
        daysUntilEvent: -offset,
        urgency: offset === 0 ? 'today' : offset > 0 ? 'overdue' : 'upcoming',
        suggestedAction: 'Ask about role clarity, manager support and access to tools.',
        preferredChannel: profile?.preferredChannel,
        ...(profile
          ? {
              messageTemplate: createOnboardingMessage(profile.displayName, milestone),
              messageAudience: 'employee' as const,
            }
          : {}),
        sources: profile ? ['official-dataset', 'demo-extension'] : ['official-dataset'],
        handled: false,
      },
    ]
  })
}

/* -------------------------------------------------------- manager check-in */

/**
 * A recorded check-in older than the rule, or none on record at all. The second
 * case is treated as the stronger prompt, not a lack of one.
 */
function detectManagerCheckins({
  todayIso,
  employeesById,
  profiles,
}: DetectionContext): HrAutomationItem[] {
  return profiles.flatMap<HrAutomationItem>((profile) => {
    const employee = employeesById.get(profile.employeeId)
    if (!isActive(employee)) return []

    const last = profile.lastManagerCheckinDate
    const daysSince = last ? daysBetween(last, todayIso) : null
    if (last && (daysSince === null || daysSince <= managerCheckinOverdueDays)) return []

    return [
      {
        id: `manager-checkin-${profile.employeeId}-${last ?? 'none'}`,
        type: 'manager-checkin',
        title: 'Manager check-in due',
        description:
          daysSince === null
            ? `No manager check-in has ever been recorded for ${profile.displayName}.`
            : `The last recorded manager check-in with ${profile.displayName} was ${daysSince} days ago.`,
        reason: `A recorded check-in older than ${managerCheckinOverdueDays} days, or none at all, prompts a reminder.`,
        employeeId: profile.employeeId,
        employeeName: profile.displayName,
        employeeContext: employeeContextOf(employee),
        urgency: 'attention',
        suggestedAction: "Ask the employee's manager to schedule a check-in.",
        /* Internal text: there is no manager contact data to address it to. */
        messageTemplate: createManagerReminder(profile.displayName, daysSince),
        messageAudience: 'internal',
        sources: ['demo-extension'],
        handled: false,
      },
    ]
  })
}

/* ---------------------------------------------------- compensation review */

/**
 * A fairness prompt, framed as a review that is due — never as a claim that
 * someone is underpaid or deserves a raise, which this dataset cannot support.
 * No amount, band or benchmark is calculated anywhere.
 *
 * A missing record produces a reminder rather than silence: an employee who has
 * never asked is not evidence that a review is unnecessary.
 */
function detectCompensationReviews({
  todayIso,
  employeesById,
  profiles,
}: DetectionContext): HrAutomationItem[] {
  return profiles.flatMap<HrAutomationItem>((profile) => {
    const employee = employeesById.get(profile.employeeId)
    if (!isActive(employee)) return []

    const last = profile.lastCompensationReviewDate
    const months = last ? monthsBetween(last, todayIso) : null
    if (last && (months === null || months < compensationReviewMonths)) return []

    return [
      {
        id: `compensation-review-${profile.employeeId}-${last ?? 'none'}`,
        type: 'compensation-review',
        title: 'Compensation review due',
        description:
          months === null
            ? `No compensation review has been recorded for ${profile.displayName}.`
            : `${profile.displayName} has not had a compensation review recorded for ${months} months.`,
        reason: `A recorded review older than ${compensationReviewMonths} months, or none at all, prompts a proactive fairness review.`,
        employeeId: profile.employeeId,
        employeeName: profile.displayName,
        employeeContext: employeeContextOf(employee),
        urgency: 'attention',
        suggestedAction: 'Review compensation against role, tenure and internal policy.',
        /* Internal only — no employee-facing message is drafted for pay. */
        linkTo: '/employees',
        linkLabel: 'Review employee',
        sources: ['demo-extension'],
        handled: false,
      },
    ]
  })
}

/* ------------------------------------------------------------ recognition */

/**
 * A prompt to *consider* whether recognition is due. The system does not decide
 * that someone deserves praise, and it drafts no automatic congratulations —
 * recognition without a reason is worth nothing to the person receiving it.
 */
function detectRecognitionReminders({
  todayIso,
  employeesById,
  profiles,
}: DetectionContext): HrAutomationItem[] {
  return profiles.flatMap<HrAutomationItem>((profile) => {
    const employee = employeesById.get(profile.employeeId)
    if (!isActive(employee)) return []

    const last = profile.lastRecognitionDate
    const daysSince = last ? daysBetween(last, todayIso) : null
    if (last && (daysSince === null || daysSince <= recognitionReminderDays)) return []

    return [
      {
        id: `recognition-${profile.employeeId}-${last ?? 'none'}`,
        type: 'recognition',
        title: 'Recognition check',
        description:
          daysSince === null
            ? `No recognition has ever been recorded for ${profile.displayName}.`
            : `${profile.displayName} was last recognised ${daysSince} days ago.`,
        reason: `A recorded recognition older than ${recognitionReminderDays} days, or none at all, prompts a review.`,
        employeeId: profile.employeeId,
        employeeName: profile.displayName,
        employeeContext: employeeContextOf(employee),
        urgency: 'attention',
        suggestedAction: 'Review recent contributions and consider appropriate recognition.',
        linkTo: '/employees',
        linkLabel: 'Review employee',
        sources: ['demo-extension'],
        handled: false,
      },
    ]
  })
}

/* --------------------------------------------------------------- actions */

/**
 * Approved demo actions approaching their deadline. Overdue actions are handled
 * by the escalation detector instead, so one action never produces two cards.
 */
function detectActionDueReminders(
  actions: readonly HrAction[],
  todayIso: string,
): HrAutomationItem[] {
  return actions.flatMap<HrAutomationItem>((action) => {
    if (classifyActionReminder(action.dueDate, action.status, todayIso) !== 'due-soon') return []

    const days = daysBetween(todayIso, action.dueDate) ?? 0
    return [
      {
        id: `action-due-${action.id}-${action.dueDate}`,
        type: 'action-due',
        title: days === 0 ? 'Action due today' : 'Action due soon',
        description: `${action.title} is due ${days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`}.`,
        reason: `Approved actions surface ${actionDueReminderDays} days before their due date.`,
        actionId: action.id,
        actionOwner: action.owner,
        eventDate: action.dueDate,
        daysUntilEvent: days,
        urgency: days === 0 ? 'today' : 'upcoming',
        suggestedAction: `Confirm progress with ${action.owner}.`,
        messageTemplate: createActionReminder(action.title, action.owner, days),
        messageAudience: 'internal',
        linkTo: '/actions',
        linkLabel: 'View action',
        sources: ['local-action'],
        handled: false,
      },
    ]
  })
}

/**
 * Overdue actions, with a prototype escalation ladder: an owner reminder from
 * day 0, a second reminder from day 3, and a recommendation to escalate from
 * day 7. Nothing is sent at any step — the ladder only changes what the card
 * suggests a person does next.
 */
function detectActionOverdue(
  actions: readonly HrAction[],
  todayIso: string,
): HrAutomationItem[] {
  return actions.flatMap<HrAutomationItem>((action) => {
    const state = classifyActionReminder(action.dueDate, action.status, todayIso)
    if (state !== 'overdue' && state !== 'escalate') return []

    const days = daysBetween(todayIso, action.dueDate)
    const daysOverdue = days === null ? 0 : Math.abs(days)
    const escalate = state === 'escalate'

    const suggestedAction = escalate
      ? 'Escalation recommended — review ownership, timeline or scope.'
      : daysOverdue >= actionSecondReminderDays
        ? `Send a second reminder to ${action.owner}.`
        : `Remind ${action.owner} that the deadline has passed.`

    return [
      {
        id: `action-overdue-${action.id}-${action.dueDate}`,
        type: 'action-overdue',
        title: escalate ? 'Action overdue — escalation recommended' : 'Action overdue',
        description: `${action.title} is ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} past its due date.`,
        reason: `Owner reminder from day 0 overdue, a second reminder from day ${actionSecondReminderDays}, and escalation recommended from day ${actionEscalationDays}.`,
        actionId: action.id,
        actionOwner: action.owner,
        eventDate: action.dueDate,
        daysUntilEvent: days ?? undefined,
        urgency: 'overdue',
        suggestedAction,
        messageTemplate: escalate
          ? createEscalationReminder(action.title, action.owner, daysOverdue)
          : createActionReminder(action.title, action.owner, 0),
        messageAudience: 'internal',
        linkTo: '/actions',
        linkLabel: 'View action',
        sources: ['local-action'],
        handled: false,
      },
    ]
  })
}

/* ------------------------------------------------------------- assembling */

/**
 * Urgency first, then the type tie-break, then the nearest event date, then id.
 * Items with no date sort after dated ones inside the same bucket.
 */
function rankItems(items: readonly HrAutomationItem[]): HrAutomationItem[] {
  return [...items].sort(
    (a, b) =>
      AUTOMATION_URGENCY_ORDER[a.urgency] - AUTOMATION_URGENCY_ORDER[b.urgency] ||
      AUTOMATION_TYPE_ORDER[a.type] - AUTOMATION_TYPE_ORDER[b.type] ||
      (a.eventDate ?? '9999-12-31').localeCompare(b.eventDate ?? '9999-12-31') ||
      a.id.localeCompare(b.id),
  )
}

/**
 * Caps each type so one busy rule cannot bury the rest, and reports what was
 * held back. A cap that hides work silently would read as "nothing else to do".
 */
function applyTypeCaps(items: readonly HrAutomationItem[]): HrAutomationResult {
  const counts = new Map<AutomationType, number>()
  const caps: AutomationTypeCap[] = []
  const kept: HrAutomationItem[] = []

  for (const item of items) {
    const seen = counts.get(item.type) ?? 0
    counts.set(item.type, seen + 1)
    if (seen < maxItemsPerType) kept.push(item)
  }

  for (const [type, detected] of counts) {
    if (detected > maxItemsPerType) caps.push({ type, shown: maxItemsPerType, detected })
  }

  return { items: kept, caps }
}

export function generateHrAutomations(
  dataset: HrDataset,
  careProfiles: readonly EmployeeCareProfile[],
  demoActions: readonly HrAction[],
  now: Date,
): HrAutomationResult {
  const context: DetectionContext = {
    todayIso: toIsoDate(now),
    /* One lookup map, built once — no `find` inside a per-employee rule. */
    employeesById: new Map(dataset.employees.map((employee) => [employee.employeeId, employee])),
    profiles: careProfiles,
  }

  const detected = [
    ...detectBirthdays(context),
    ...detectWorkAnniversaries(context),
    ...detectOnboardingMilestones(context),
    ...detectManagerCheckins(context),
    ...detectCompensationReviews(context),
    ...detectRecognitionReminders(context),
    ...detectActionDueReminders(demoActions, context.todayIso),
    ...detectActionOverdue(demoActions, context.todayIso),
  ]

  /* Stable ids make the de-duplication total: one event, one reminder. */
  const unique = new Map(detected.map((item) => [item.id, item]))

  return applyTypeCaps(rankItems([...unique.values()]))
}

export { demoCareProfiles }
