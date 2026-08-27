import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { EvidenceFormat, InsightEvidence } from '@/types/hr-insights'
import {
  EMPTY_VALUE,
  formatCount,
  formatDelta,
  formatPercentage,
  formatScoreOutOf,
} from '@/utils/format'

type InsightEvidenceListProps = {
  evidence: InsightEvidence[]
}

/**
 * One renderer for every evidence row, whatever the category. Values arrive as
 * raw numbers from the engine and are formatted here, at the UI boundary.
 */
const FORMATTERS: Record<EvidenceFormat, (value: number) => string> = {
  score: (value) => formatScoreOutOf(value, SCORE_SCALE.max),
  percentage: (value) => formatPercentage(value),
  ratio: (value) => value.toFixed(2),
  count: (value) => formatCount(value),
  delta: (value) => formatDelta(value),
  points: (value) => `${formatDelta(value)} pp`,
  multiplier: (value) => `${value.toFixed(2)}×`,
  text: (value) => value.toLocaleString(),
}

function renderValue(value: number | string, format: EvidenceFormat = 'text'): string {
  if (typeof value === 'string') return value === '' ? EMPTY_VALUE : value
  if (!Number.isFinite(value)) return EMPTY_VALUE
  return FORMATTERS[format](value)
}

export function InsightEvidenceList({ evidence }: InsightEvidenceListProps) {
  return (
    <dl className="divide-y">
      {evidence.map((item) => (
        <div key={item.label} className="grid gap-1 py-2.5 sm:grid-cols-[1fr_auto] sm:items-baseline">
          <div className="min-w-0">
            <dt className="text-sm font-medium">{item.label}</dt>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
          <dd className="text-left tabular-nums sm:text-right">
            <span className="text-sm font-medium">{renderValue(item.value, item.format)}</span>
            {item.comparison !== undefined ? (
              <span className="block text-xs text-muted-foreground">
                vs {renderValue(item.comparison, item.format)}
                {item.comparisonLabel ? ` · ${item.comparisonLabel}` : ''}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
