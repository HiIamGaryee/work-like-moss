import { NEW_JOINER_MAX_MONTHS, SCORE_SCALE } from '@/data/hr-analytics.constants'

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
  openActions: 'Recorded actions with a status other than Completed.',
  exitRecords: 'Employees marked as Leaver. Exit survey details are included where available.',
  leaverRate: 'Share of employees in the dataset marked as Leaver.',
  pulseEngagement: 'Latest wave average. Change is measured against the first wave.',
  newJoiner: `Average overall score from employees in their first ${NEW_JOINER_MAX_MONTHS} months.`,
  baseEngagement: 'Baseline engagement score stored per employee, on a 0–1 scale.',
  divisionPulse: 'Latest pulse wave engagement for employees in this division.',
} as const

/**
 * Evidence strength as stars, mapped from the engine's own strength field. Never
 * 5: nothing above `strong` exists, so a top rating would overstate the evidence.
 */
export const EVIDENCE_STRENGTH_RATING = {
  strong: { stars: 4, label: 'Strong' },
  moderate: { stars: 3, label: 'Moderate' },
  limited: { stars: 2, label: 'Limited' },
  watch: { stars: 2, label: 'Watch' },
} as const

export const EVIDENCE_STAR_MAX = 5

/** Short dataset names for compact evidence rows. */
export const DATA_SOURCE_SHORT_LABELS = {
  Employees: 'Employees',
  'Onboarding Survey': 'Onboarding',
  'Pulse Survey': 'Pulse',
  'Exit Survey': 'Exit',
  'Action Tracker': 'Actions',
} as const

/** How many action records the read-only list shows. */
export const ACTION_RECORD_LIMIT = 5
