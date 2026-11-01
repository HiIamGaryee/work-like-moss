import { MetricCard } from '@/components/dashboard/metric-card'
import type { ImpactSummary as ImpactSummaryCounts } from '@/types/hr-impact'
import { EMPTY_VALUE, formatCount } from '@/utils/format'

type ImpactSummaryProps = {
  summary: ImpactSummaryCounts
}

/**
 * Counts derived from the live impact list. The achievement rate stays an em
 * dash until enough actions have actually been judged — a rate off an empty or
 * near-empty denominator would read as a verdict the data cannot support.
 */
export function ImpactSummary({ summary }: ImpactSummaryProps) {
  const impactSummaryItems = [
    {
      label: 'Completed actions',
      value: formatCount(summary.completedActions),
      hint: 'Activity completed, not outcome success.',
    },
    {
      label: 'Awaiting measurement',
      value: formatCount(summary.awaitingMeasurement),
      hint: 'No later comparable reading yet.',
    },
    {
      label: 'Measured outcomes',
      value: formatCount(summary.measurementsAvailable),
      hint: 'A later comparable reading exists.',
    },
    {
      label: 'Improved',
      value: formatCount(summary.improved),
      hint: 'Meaningful favourable movement observed.',
    },
    {
      label: 'Targets met',
      value: formatCount(summary.targetsMet),
      hint: 'Tracked separately from improvement status.',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {impactSummaryItems.map((item) => (
        <MetricCard key={item.label} {...item} value={item.value || EMPTY_VALUE} />
      ))}
    </div>
  )
}
