import { devWarn } from '@/utils/dev-warn'

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
  return String(value).trim()
}

export function toNullableText(value: unknown): string | null {
  const text = toText(value)
  return EMPTY_TEXT.has(text.toLowerCase()) ? null : text
}

export function toNumber(value: unknown, context: string): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const text = toText(value)
  if (EMPTY_TEXT.has(text.toLowerCase())) return 0

  const parsed = Number(text)
  if (Number.isFinite(parsed)) return parsed

  devWarn(`${context}: expected a number, received "${text}" — using 0`)
  return 0
}

/**
 * `aliases` maps a lowercased source spelling onto a canonical value, so a
 * workbook wording difference does not silently collapse into the fallback.
 */
export function toEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  context: string,
  aliases?: Readonly<Record<string, T>>,
): T {
  const text = toText(value)
  const match = allowed.find((option) => option.toLowerCase() === text.toLowerCase())
  if (match) return match

  const alias = aliases?.[text.toLowerCase()]
  if (alias) return alias

  devWarn(`${context}: unexpected value "${text}" — using "${fallback}"`)
  return fallback
}
