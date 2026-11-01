import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { ImpactMeasurement } from '@/types/hr-impact'
import { EMPTY_VALUE, formatDelta, formatPercentage, formatScore } from '@/utils/format'

/** Display helpers shared by every Impact view. Numbers stay raw until here. */

type Unit = ImpactMeasurement['unit']

export function formatImpactValue(value: number | null, unit: Unit): string {
  if (value === null) return EMPTY_VALUE
  if (unit === 'percentage') return formatPercentage(value)
  if (unit === 'count') return value.toLocaleString()
  return formatScore(value)
}

export const impactScaleSuffix = (unit: Unit): string =>
  unit === 'score' ? ` / ${SCORE_SCALE.max}` : ''

export const formatImpactChange = (difference: number | null, unit: Unit): string =>
  difference === null
    ? EMPTY_VALUE
    : `${formatDelta(difference)}${unit === 'percentage' ? ' pp' : ''}`
