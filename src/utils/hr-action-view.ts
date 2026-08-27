import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { ActionMetric, HrAction } from '@/types/hr-actions'
import { daysBetween, isBefore } from '@/utils/date'
import { EMPTY_VALUE, formatCount, formatPercentage, formatScoreOutOf } from '@/utils/format'

/**
 * Display helpers shared by every Action Centre view, so no card restates how a
 * metric is rendered or how a deadline is read. Numbers stay raw until here.
 */

/** Renders a metric in its own unit; a missing value is an em dash, not a zero. */
export function formatActionMetric(metric: ActionMetric | undefined): string {
  if (!metric || metric.value === null) return EMPTY_VALUE
  if (metric.unit === 'score') return formatScoreOutOf(metric.value, SCORE_SCALE.max)
  if (metric.unit === 'percentage') return formatPercentage(metric.value)
  return formatCount(metric.value)
}

/**
 * Overdue is derived, never stored: an action past its due date that has not
 * been completed or cancelled. Adding a fifth status would only duplicate what
 * the date already says.
 */
export const isActionOverdue = (action: HrAction, today: string): boolean =>
  action.status !== 'completed' &&
  action.status !== 'cancelled' &&
  isBefore(action.dueDate, today)

/** "Due in 12 days" / "Due today" / "Overdue by 3 days". No reminders are sent. */
export function formatDueWindow(action: HrAction, today: string): string {
  if (action.status === 'completed') return 'Completed'
  if (action.status === 'cancelled') return 'Cancelled'

  const days = daysBetween(today, action.dueDate)
  if (days === null) return EMPTY_VALUE
  if (days === 0) return 'Due today'
  if (days > 0) return `Due in ${days} ${days === 1 ? 'day' : 'days'}`

  const overdue = Math.abs(days)
  return `Overdue by ${overdue} ${overdue === 1 ? 'day' : 'days'}`
}
