import { safeNumber } from '@/utils/analytics'

export type SheetRow = Record<string, unknown>

const EMPTY_TEXT = new Set(['', '-', 'n/a', 'na', 'null', 'undefined'])

const normaliseKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Excel headers vary in casing and separators between sheets, so lookups are
 * matched on a normalised key. Every field still declares its expected header
 * explicitly — nothing is mapped generically.
 */
export function createRowReader(row: SheetRow) {
  const index = new Map<string, unknown>()
  for (const [key, value] of Object.entries(row)) {
    index.set(normaliseKey(key), value)
  }

  return (...headers: string[]): unknown => {
    for (const header of headers) {
      const value = index.get(normaliseKey(header))
      if (value !== undefined) return value
    }
    return null
  }
}

export function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function toNullableText(value: unknown): string | null {
  const text = toText(value)
  return text.trim() === '' ? null : text
}

export function toNumber(value: unknown): number | null {
  const text = toText(value)
  return EMPTY_TEXT.has(text.trim().toLowerCase()) ? null : safeNumber(value)
}
