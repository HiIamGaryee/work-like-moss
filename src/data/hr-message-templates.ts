import type { AutomationMessage } from '@/types/hr-automation'

/**
 * Every suggested message the system can produce.
 *
 * Two rules are absolute here:
 *
 *  1. **Nothing from the analytics layer goes into an employee-facing message.**
 *     No engagement score, no priority score, no exit-risk wording, no survey
 *     answer, no compensation history. A birthday wish that mentions what HR
 *     measured about someone is a betrayal of the person, not a feature.
 *     Personalisation is limited to a display name, a milestone and a year count.
 *
 *  2. **Internal reminders stay internal.** Manager, compensation and
 *     escalation text is written for HR to read and forward deliberately — it is
 *     never addressed to the employee.
 *
 * Text is plain, warm and short. No motivational essays, and no HTML: these
 * strings end up in a `mailto:` body or a WhatsApp share, both plain text.
 */

const firstName = (displayName: string): string => displayName.trim().split(/\s+/)[0] ?? displayName

/* ------------------------------------------------------- employee-facing */

export function createBirthdayMessage(displayName: string): AutomationMessage {
  const name = firstName(displayName)
  return {
    subject: `Happy birthday, ${name}!`,
    body: `Happy birthday, ${name}!

Wishing you a wonderful year ahead. Thank you for everything you contribute to the team.`,
  }
}

export function createAnniversaryMessage(displayName: string, years: number): AutomationMessage {
  const name = firstName(displayName)
  const label = `${years}-year`
  return {
    subject: `Congratulations on your ${label} work anniversary`,
    body: `Congratulations on your ${label} work anniversary, ${name}!

Thank you for your contribution and commitment to the team. We appreciate having you with us.`,
  }
}

export function createOnboardingMessage(displayName: string, milestoneDay: number): AutomationMessage {
  const name = firstName(displayName)
  return {
    subject: `How are your first ${milestoneDay} days going?`,
    body: `Hi ${name},

You've now been with us for around ${milestoneDay} days.

We'd love to know how your onboarding experience has been so far, and whether there is anything we can support you with.`,
  }
}

/* ------------------------------------------------------ internal HR text */

/**
 * Written for the employee's manager. No manager contact data exists in this
 * dataset, so the text carries no recipient and no salutation — HR addresses it
 * to the right person themselves.
 */
export function createManagerReminder(displayName: string, daysSince: number | null): AutomationMessage {
  const gap =
    daysSince === null
      ? 'No manager check-in has been recorded for this employee.'
      : `The last recorded manager check-in was ${daysSince} days ago.`

  return {
    subject: `Manager check-in due — ${displayName}`,
    body: `A manager check-in is due for ${displayName}.

${gap}

Please schedule a short conversation to review current support needs, workload and role clarity.`,
  }
}

export function createActionReminder(
  actionTitle: string,
  owner: string,
  daysUntilDue: number,
): AutomationMessage {
  const timing =
    daysUntilDue === 0
      ? 'is due today'
      : `is due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`

  return {
    subject: `HR action ${daysUntilDue === 0 ? 'due today' : 'due soon'} — ${actionTitle}`,
    body: `The following HR action ${timing}.

Action: ${actionTitle}
Owner: ${owner}

Please confirm progress, or update the timeline if the scope has changed.`,
  }
}

/**
 * Escalation text describes the state of the work, not the character of the
 * person who owns it. It asks what needs to change; it does not assign blame.
 */
export function createEscalationReminder(
  actionTitle: string,
  owner: string,
  daysOverdue: number,
): AutomationMessage {
  return {
    subject: `HR action ${daysOverdue} days overdue — ${actionTitle}`,
    body: `This HR action is now ${daysOverdue} days past its due date.

Action: ${actionTitle}
Owner: ${owner}

Please review progress and confirm whether ownership, timeline or intervention scope needs to be adjusted.`,
  }
}
