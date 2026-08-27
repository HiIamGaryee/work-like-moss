import { SCORE_SCALE } from '@/data/hr-analytics.constants'

/**
 * Presentation constants for the executive dashboard. Chart colours live here
 * rather than in individual chart components, and they resolve to the semantic
 * theme tokens so the whole dashboard stays monochrome in light and dark.
 */

export const CHART_SERIES_COLOR = 'var(--chart-series)'
export const CHART_MUTED_COLOR = 'var(--chart-series-muted)'
export const CHART_GRID_COLOR = 'var(--chart-grid)'

/** Survey charts are plotted on the documented 1–5 scale, never auto-scaled. */
export const SCORE_AXIS_DOMAIN: readonly [number, number] = [SCORE_SCALE.min, SCORE_SCALE.max]

export const SCORE_AXIS_TICKS = [1, 2, 3, 4, 5]

/** Short, consistent wording for the metrics a reader could misread. */
export const METRIC_HINTS = {
  totalEmployees: 'Every row in the official Employees sheet, active and leavers together.',
  leaverRate: 'Percentage of employees in this dataset marked as Leaver.',
  pulseEngagement: 'Average engagement score from the latest pulse survey wave.',
  newJoiner: 'Employees with tenure of six months or less.',
  openActions: 'Recorded actions with a status other than Completed.',
  baseEngagement: 'Baseline engagement score stored per employee, on a 0–1 scale.',
  divisionPulse: 'Latest pulse wave engagement for employees in this division.',
} as const

/** How many action records the read-only list shows. */
export const ACTION_RECORD_LIMIT = 5
