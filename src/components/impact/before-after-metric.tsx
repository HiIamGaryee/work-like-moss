import { ArrowRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { ImpactMeasurement } from '@/types/hr-impact'
import { EMPTY_VALUE, formatDate, formatDelta, formatPercentage, formatScore } from '@/utils/format'

type BeforeAfterMetricProps = {
  measurement: ImpactMeasurement
}

const readValue = (value: number | null, unit: ImpactMeasurement['unit']): string => {
  if (value === null) return EMPTY_VALUE
  if (unit === 'percentage') return formatPercentage(value)
  if (unit === 'count') return value.toLocaleString()
  return formatScore(value)
}

/**
 * Three numbers and the movement between them. Two data points do not warrant a
 * chart, so this stays a compact readout — and the progress bar measures the
 * baseline → target span, not `current / target`, which would report most of the
 * way there for a metric that never moved.
 */
export function BeforeAfterMetric({ measurement }: BeforeAfterMetricProps) {
  const { unit, baselineValue, currentValue, targetValue, difference, progressToTarget } =
    measurement

  const scaleSuffix = unit === 'score' ? ` / ${SCORE_SCALE.max}` : ''

  const columns = [
    {
      key: 'baseline', label: 'Baseline', value: baselineValue,
      date: measurement.baselineDate, period: measurement.baselinePeriod,
      sampleSize: measurement.baselineSampleSize,
    },
    {
      key: 'current', label: 'Current', value: currentValue,
      date: measurement.currentDate, period: measurement.currentPeriod,
      sampleSize: measurement.currentSampleSize,
    },
    { key: 'target', label: 'Target', value: targetValue, date: null, period: null, sampleSize: null },
  ]

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-1">
        {columns.map((column) => (
          <div key={column.key} className="min-w-0 space-y-0.5">
            <dt className="text-xs text-muted-foreground">{column.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {column.key === 'target' && column.value === null
                ? 'No numeric target'
                : readValue(column.value, unit)}
              {column.value === null ? '' : (
                <span className="text-xs font-normal text-muted-foreground">{scaleSuffix}</span>
              )}
            </dd>
            {column.period || column.date ? (
              <dd className="text-xs break-words text-muted-foreground">
                {[column.period, column.date ? formatDate(column.date) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            ) : null}
            {column.sampleSize !== null ? (
              <dd className="text-xs text-muted-foreground tabular-nums">
                n = {column.sampleSize.toLocaleString()}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
          Observed change
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {difference === null
            ? EMPTY_VALUE
            : `${formatDelta(difference)}${unit === 'percentage' ? ' pp' : ''}`}
        </span>
        {measurement.percentageChange !== null ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDelta(measurement.percentageChange, 1)}% relative
          </span>
        ) : null}
      </div>

      {progressToTarget === null ? null : (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">Progress toward target</span>
            <span className="text-sm font-medium tabular-nums">
              {formatPercentage(progressToTarget, 0)}
            </span>
          </div>
          <Progress
            value={progressToTarget}
            aria-label={`Progress from baseline toward target for ${measurement.label}`}
          />
        </div>
      )}
    </div>
  )
}
