/**
 * Calendar arithmetic for action timelines and care reminders.
 *
 * Dates are stored as `YYYY-MM-DD` throughout the app and are compared as UTC
 * midnight, so adding a duration can never drift across a daylight-saving
 * boundary — and "birthday tomorrow" cannot silently become "birthday today"
 * because a timestamp crossed midnight in another zone. The only place local
 * time is read is `todayIsoDate`/`toIsoDate`, which resolve *which* calendar day
 * the viewer is on. Display formatting stays in `@/utils/format`.
 *
 * Month and year arithmetic uses calendar fields rather than a fixed number of
 * milliseconds, so leap years and short months are handled by the calendar
 * itself instead of by an approximation.
 */

const MS_PER_DAY = 86_400_000

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseIsoDate = (value: string): number | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isNaN(parsed) ? null : parsed
}

export const isValidIsoDate = (value: string): boolean => parseIsoDate(value) !== null

/** Today in the viewer's own calendar, not UTC — an owner's deadline is local. */
export function todayIsoDate(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Returns the input unchanged when it is not a parseable date. */
export function addDays(isoDate: string, days: number): string {
  const parsed = parseIsoDate(isoDate)
  if (parsed === null) return isoDate
  return new Date(parsed + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = parseIsoDate(fromIso)
  const to = parseIsoDate(toIso)
  if (from === null || to === null) return null
  return Math.round((to - from) / MS_PER_DAY)
}

export function isBefore(isoDate: string, referenceIso: string): boolean {
  const value = parseIsoDate(isoDate)
  const reference = parseIsoDate(referenceIso)
  if (value === null || reference === null) return false
  return value < reference
}

/** A `Date` reduced to the local calendar day it falls on. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

type DateParts = { year: number; month: number; day: number }

/** `null` for anything that is not a real calendar date. */
export function isoDateParts(isoDate: string): DateParts | null {
  const parsed = parseIsoDate(isoDate)
  if (parsed === null) return null
  const date = new Date(parsed)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

/**
 * Builds a calendar date, clamping the day to the month's real length. Asking
 * for 31 February yields 28 or 29 February rather than rolling into March.
 */
export function buildIsoDate(year: number, month: number, day: number): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const safeDay = Math.min(Math.max(1, day), daysInMonth)
  return `${year}-${`${month}`.padStart(2, '0')}-${`${safeDay}`.padStart(2, '0')}`
}

/** Calendar months elapsed, ignoring the day-of-month remainder. */
export function monthsBetween(fromIso: string, toIso: string): number | null {
  const from = isoDateParts(fromIso)
  const to = isoDateParts(toIso)
  if (!from || !to) return null

  const months = (to.year - from.year) * 12 + (to.month - from.month)
  /* A partial month does not count: 14 Jan → 13 Feb is 0 months, not 1. */
  return to.day >= from.day ? months : months - 1
}

/** Adds whole calendar months, clamping the day into the target month. */
export function addMonths(isoDate: string, months: number): string {
  const parts = isoDateParts(isoDate)
  if (!parts) return isoDate
  const zeroBased = parts.month - 1 + months
  return buildIsoDate(parts.year + Math.floor(zeroBased / 12), (zeroBased % 12 + 12) % 12 + 1, parts.day)
}

/**
 * The next time a month/day recurs, counting today as the next occurrence.
 * A 29 February birthday lands on 28 February in a non-leap year rather than
 * disappearing from the calendar.
 */
export function nextOccurrence(month: number, day: number, fromIso: string): string | null {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const from = isoDateParts(fromIso)
  if (!from) return null

  const thisYear = buildIsoDate(from.year, month, day)
  return isBefore(thisYear, fromIso) ? buildIsoDate(from.year + 1, month, day) : thisYear
}

/**
 * The next work anniversary and the number of completed years it will mark.
 * Today counts as the anniversary.
 *
 * `null` when there is nothing to congratulate: a join date in the future, or a
 * join date whose anniversary still falls inside the joining year — someone who
 * started today has no first anniversary yet. Callers apply their own reminder
 * window on top; this only answers "when, and which year".
 */
export function nextAnniversary(
  joinIso: string,
  fromIso: string,
): { date: string; years: number } | null {
  const join = isoDateParts(joinIso)
  const from = isoDateParts(fromIso)
  if (!join || !from) return null
  if (isBefore(fromIso, joinIso)) return null

  const thisYear = buildIsoDate(from.year, join.month, join.day)
  const date = isBefore(thisYear, fromIso)
    ? buildIsoDate(from.year + 1, join.month, join.day)
    : thisYear

  const years = (isoDateParts(date)?.year ?? from.year) - join.year
  return years < 1 ? null : { date, years }
}

/** "today" / "tomorrow" / "in 4 days" / "8 days ago". */
export function formatRelativeDay(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 0) return `in ${days} days`
  return `${Math.abs(days)} days ago`
}
