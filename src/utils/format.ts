import type { ChangeDirection } from '@/types/hr-analytics'
import type { MetricValue } from '@/utils/analytics'

/**
 * The formatting boundary. Analytics returns real numbers; everything that
 * turns a number into display text lives here, and `null` always becomes an
 * em dash rather than a zero.
 */

export const EMPTY_VALUE = '—'

/**
 * Whether a metric label describes a rate or a share rather than a 1–5 survey
 * score. The workbook has no unit column, so the label is the only signal — and
 * it must be read in exactly one place.
 */
export const isRateMetricLabel = (metricLabel: string): boolean =>
  /rate|share/i.test(metricLabel)

export function formatCount(value: MetricValue): string {
  return value === null ? EMPTY_VALUE : value.toLocaleString()
}

/** Survey scores on the 1–5 scale. */
export function formatScore(value: MetricValue, decimals = 2): string {
  return value === null ? EMPTY_VALUE : value.toFixed(decimals)
}

/** Values that are already a percentage, e.g. `11` → `11.0%`. */
export function formatPercentage(value: MetricValue, decimals = 1): string {
  return value === null ? EMPTY_VALUE : `${value.toFixed(decimals)}%`
}

/** Values stored as a 0–1 ratio, e.g. `0.6616` → `66%`. Never mutates the source. */
export function formatRatioAsPercentage(value: MetricValue, decimals = 0): string {
  return value === null ? EMPTY_VALUE : `${(value * 100).toFixed(decimals)}%`
}

/** A survey score with its scale spelled out, e.g. `3.4` → `3.40 / 5`. */
export function formatScoreOutOf(value: MetricValue, max: number, decimals = 2): string {
  return value === null ? EMPTY_VALUE : `${value.toFixed(decimals)} / ${max}`
}

/** Signed change, e.g. `0.03` → `+0.03`. Zero keeps no sign. */
export function formatDelta(value: MetricValue, decimals = 2): string {
  if (value === null) return EMPTY_VALUE
  const rounded = value.toFixed(decimals)
  return value > 0 ? `+${rounded}` : rounded
}

/** `2026-06-15` → `15 Jun 2026`. Returns the em dash for a missing date. */
export function formatDate(value: string | null): string {
  if (!value) return EMPTY_VALUE
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return EMPTY_VALUE
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Percentage of a 1–`max` score, for progress-bar width only. */
export function scoreToProgress(value: MetricValue, max: number): number {
  if (value === null) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

/**
 * Wave-over-wave change in words. A `flat` direction means the measured change
 * sat inside the analytics tolerance, so it reads as "no change" rather than a
 * misleading `+0.00`.
 */
export function formatChangeLabel(
  absoluteChange: MetricValue,
  direction: ChangeDirection,
  reference: string,
): string {
  if (direction === 'flat') return `No change since ${reference}`
  return `${formatDelta(absoluteChange)} since ${reference}`
}
