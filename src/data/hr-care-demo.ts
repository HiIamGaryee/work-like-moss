import type { CareChannel, EmployeeCareProfile } from '@/types/hr-automation'
import { addDays, addMonths, isoDateParts, todayIsoDate } from '@/utils/date'

/**
 * ============================================================================
 *  DEMO EXTENSION DATA — NOT PART OF THE OFFICIAL COMPETITION DATASET
 * ============================================================================
 *
 * `public/data/culture-retention-dummy-data.xlsx` is Glocomp's official
 * workbook and is never edited. It carries employee IDs, divisions, groups,
 * locations, join dates, tenure, engagement and exit status — but no names, no
 * birthdays, and no record of when anyone was last spoken to, reviewed or
 * recognised. HR care automation needs those fields, so this file supplies them
 * as a clearly-labelled extension.
 *
 * What that means in practice:
 *
 *  - Every `displayName` here is SYNTHETIC. The official dataset contains no
 *    employee names. These are placeholders so a demo card can read as a person
 *    rather than an ID.
 *  - Every date here is FABRICATED for demonstration and is built relative to
 *    today, so the page always has something meaningful to show.
 *  - Every `preferredChannel` is a PROTOTYPE DEMONSTRATION VALUE. It is not a
 *    recorded preference and it is not consent. Production use would require
 *    stored communication preferences and explicit employee consent before any
 *    message was drafted, let alone sent.
 *  - `employeeId` values are REAL IDs from the official Employees sheet, so the
 *    extension joins onto official records instead of inventing people. Division,
 *    group and join date are always read from the workbook, never from here.
 *
 * Anything the UI builds from this file is badged "Demo Extension" so a reader
 * can never mistake a synthetic birthday for official competition evidence.
 *
 * Deliberately absent, because the workflow does not need them: birth year,
 * age, marital status, dependants, health, religion, ethnicity, politics.
 */

/** Kept small on purpose — enough to demonstrate each rule, no more. */
const today = todayIsoDate()

const daysAgo = (days: number): string => addDays(today, -days)
const monthsAgo = (months: number): string => addMonths(today, -months)

/** Month/day of a date relative to today, for a birthday that always lands. */
function birthdayIn(days: number): { birthdayMonth: number; birthdayDay: number } {
  const parts = isoDateParts(addDays(today, days))
  /* `today` is always valid, so the fallback is unreachable in practice. */
  return { birthdayMonth: parts?.month ?? 1, birthdayDay: parts?.day ?? 1 }
}

type DemoProfile = EmployeeCareProfile & {
  /** What this profile exists to demonstrate. Developer documentation only. */
  demonstrates: string
}

/**
 * Ten profiles, each with one clear story. `null` means "no record exists",
 * which is treated as a stronger reason to review than a stale record — silence
 * is not evidence that someone is fine.
 */
const DEMO_CARE_PROFILES: readonly DemoProfile[] = [
  {
    employeeId: 'E0401',
    displayName: 'Alex Tan',
    ...birthdayIn(0),
    preferredChannel: 'whatsapp',
    lastManagerCheckinDate: daysAgo(12),
    lastCompensationReviewDate: monthsAgo(5),
    lastRecognitionDate: daysAgo(25),
    demonstrates: 'Birthday today, plus a work anniversary from the official join date.',
  },
  {
    employeeId: 'E0444',
    displayName: 'Sarah Lim',
    ...birthdayIn(1),
    preferredChannel: 'email',
    lastManagerCheckinDate: daysAgo(18),
    lastCompensationReviewDate: monthsAgo(4),
    lastRecognitionDate: daysAgo(30),
    demonstrates: 'Birthday tomorrow — the one-day-ahead reminder rule.',
  },
  {
    employeeId: 'E0264',
    displayName: 'Daniel Wong',
    birthdayMonth: 2,
    birthdayDay: 29,
    preferredChannel: 'email',
    lastManagerCheckinDate: daysAgo(52),
    lastCompensationReviewDate: monthsAgo(7),
    lastRecognitionDate: daysAgo(40),
    demonstrates:
      'Manager check-in overdue at 52 days. A 29 February birthday also exercises leap-year handling.',
  },
  {
    employeeId: 'E0012',
    displayName: 'Priya Nair',
    birthdayMonth: 3,
    birthdayDay: 14,
    preferredChannel: 'whatsapp',
    lastManagerCheckinDate: daysAgo(9),
    lastCompensationReviewDate: monthsAgo(18),
    lastRecognitionDate: daysAgo(35),
    demonstrates: 'Compensation review last recorded 18 months ago.',
  },
  {
    employeeId: 'E0139',
    displayName: 'Wei Jun Ho',
    birthdayMonth: 11,
    birthdayDay: 2,
    preferredChannel: 'email',
    lastManagerCheckinDate: daysAgo(20),
    lastCompensationReviewDate: monthsAgo(6),
    lastRecognitionDate: daysAgo(120),
    demonstrates: 'Recognition last recorded 120 days ago.',
  },
  {
    employeeId: 'E0376',
    displayName: 'Nurul Aisyah',
    birthdayMonth: 6,
    birthdayDay: 21,
    preferredChannel: 'none',
    lastManagerCheckinDate: daysAgo(14),
    lastCompensationReviewDate: monthsAgo(3),
    lastRecognitionDate: daysAgo(21),
    demonstrates:
      'Everything recorded and recent — proves the inbox stays quiet when nothing needs attention.',
  },
  {
    employeeId: 'E0044',
    displayName: 'Marcus Lee',
    birthdayMonth: 1,
    birthdayDay: 9,
    preferredChannel: 'email',
    lastManagerCheckinDate: null,
    lastCompensationReviewDate: monthsAgo(8),
    lastRecognitionDate: daysAgo(45),
    demonstrates: 'No manager check-in has ever been recorded.',
  },
  {
    employeeId: 'E0115',
    displayName: 'Chloe Tan',
    birthdayMonth: 9,
    birthdayDay: 30,
    preferredChannel: 'whatsapp',
    lastManagerCheckinDate: daysAgo(21),
    lastCompensationReviewDate: monthsAgo(13),
    lastRecognitionDate: daysAgo(50),
    demonstrates: 'Compensation review just past the 12-month rule, at 13 months.',
  },
  {
    employeeId: 'E0280',
    displayName: 'Ravi Kumar',
    birthdayMonth: 12,
    birthdayDay: 5,
    preferredChannel: 'email',
    lastManagerCheckinDate: daysAgo(30),
    lastCompensationReviewDate: monthsAgo(2),
    lastRecognitionDate: daysAgo(95),
    demonstrates: 'Recognition just past the 90-day rule, at 95 days.',
  },
  {
    employeeId: 'E0490',
    displayName: 'Grace Lim',
    birthdayMonth: 4,
    birthdayDay: 18,
    preferredChannel: 'none',
    lastManagerCheckinDate: daysAgo(23),
    lastCompensationReviewDate: null,
    lastRecognitionDate: null,
    demonstrates:
      'No compensation review or recognition on record, and no preferred channel — only Copy Message is offered.',
  },
]

/**
 * The care profiles, with the developer-only `demonstrates` note stripped so it
 * can never reach a component or a message.
 */
export const demoCareProfiles: readonly EmployeeCareProfile[] = DEMO_CARE_PROFILES.map(
  ({ demonstrates: _demonstrates, ...profile }) => profile,
)

export const DEMO_EXTENSION_NOTE =
  'Names, birthdays, channel preferences and care history are clearly-labelled demo extension data, not part of the official Glocomp workbook. Division, group and join date always come from the official Employees sheet.'

export const CHANNEL_CONSENT_NOTE =
  'Preferred channel is prototype demonstration data. Production use would require recorded communication preferences and explicit employee consent.'

/** Channels a reviewer may pick in the message panel. */
export const CARE_CHANNEL_OPTIONS: readonly CareChannel[] = ['email', 'whatsapp', 'none']
