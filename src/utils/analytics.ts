/**
 * Pure, domain-free helpers for the analytics layer.
 *
 * Two rules hold throughout:
 * 1. Nothing here mutates its input — every sort/group returns a new value.
 * 2. "No data" is `null`, never `0`, `NaN` or an invented fallback, so the UI
 *    can render an em dash instead of a misleading number.
 */

export type MetricValue = number | null

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const isInRange = (value: unknown, min: number, max: number): value is number =>
  isFiniteNumber(value) && value >= min && value <= max

export function safeNumber(value: unknown): MetricValue {
  if (isFiniteNumber(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Rounds only when there is a value; `null` stays `null`. */
export function roundOrNull(value: MetricValue, decimals = 2): MetricValue {
  return value === null ? null : round(value, decimals)
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * Mean of the finite values only. Invalid entries (`null`, `undefined`, `NaN`)
 * are excluded from both the numerator and the denominator rather than being
 * coerced to `0`, which would drag the average down. An empty set is `null`.
 */
export function average(values: readonly (number | null | undefined)[]): MetricValue {
  const valid = values.filter(isFiniteNumber)
  return valid.length === 0 ? null : sum(valid) / valid.length
}

/** Mean of a projected field, keeping the exclusion rules of `average`. */
export function averageBy<T>(
  items: readonly T[],
  getValue: (item: T) => number | null | undefined,
): MetricValue {
  return average(items.map(getValue))
}

/** `part / total × 100`, or `null` when the denominator carries no information. */
export function percentage(part: number, total: number): MetricValue {
  if (!isFiniteNumber(part) || !isFiniteNumber(total) || total === 0) return null
  return (part / total) * 100
}

export function groupBy<T, K>(
  items: readonly T[],
  getKey: (item: T) => K | null,
): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = getKey(item)
    if (key === null) continue
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }
  return groups
}

export function countBy<T, K>(items: readonly T[], getKey: (item: T) => K | null): Map<K, number> {
  const counts = new Map<K, number>()
  for (const item of items) {
    const key = getKey(item)
    if (key === null) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function countWhere<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.reduce((total, item) => (predicate(item) ? total + 1 : total), 0)
}

/** Copies before sorting; `null` values always sink to the bottom. */
export function sortDescending<T>(items: readonly T[], getValue: (item: T) => MetricValue): T[] {
  return [...items].sort((a, b) => {
    const left = getValue(a)
    const right = getValue(b)
    if (left === null || right === null) return compareValues(left, right)
    return right - left
  })
}

export function sortAscending<T>(items: readonly T[], getValue: (item: T) => MetricValue): T[] {
  return [...items].sort((a, b) => compareValues(getValue(a), getValue(b)))
}

function compareValues(a: MetricValue, b: MetricValue): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

export function sortByText<T>(items: readonly T[], getText: (item: T) => string): T[] {
  return [...items].sort((a, b) => getText(a).localeCompare(getText(b)))
}

/** Lowest entry by value, ignoring entries without a value. */
export function minBy<T>(items: readonly T[], getValue: (item: T) => MetricValue): T | null {
  const ranked = sortAscending(items, getValue).filter((item) => getValue(item) !== null)
  return ranked[0] ?? null
}

export function subtract(a: MetricValue, b: MetricValue): MetricValue {
  return a === null || b === null ? null : a - b
}

/** Distinct values in first-seen order — deterministic for a fixed dataset. */
export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}
