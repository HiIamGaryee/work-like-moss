const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000

function toIsoDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

/**
 * Converts an Excel cell value into a `YYYY-MM-DD` string.
 *
 * Accepts Excel serial numbers, date strings, `Date` objects, and empty values.
 * Anything unparseable becomes `null` rather than an `Invalid Date`.
 */
export function excelSerialToDate(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) return toIsoDate(value)

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return toIsoDate(new Date(EXCEL_EPOCH_UTC + Math.round(value) * MS_PER_DAY))
  }

  const text = String(value).trim()
  if (text === '') return null

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return excelSerialToDate(Number(text))
  }

  return toIsoDate(new Date(text))
}
