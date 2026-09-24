import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      key: 'completed',
      label: 'Completed actions',
      value: formatCount(summary.completedActions),
      description: 'Activity completed, not outcome success',
    },
    {
      key: 'awaiting',
      label: 'Awaiting measurement',
      value: formatCount(summary.awaitingMeasurement),
      description: 'No later comparable reading yet',
    },
    {
      key: 'measured',
      label: 'Measured outcomes',
      value: formatCount(summary.measurementsAvailable),
      description: 'A later reading exists',
    },
    {
      key: 'improved',
      label: 'Improved',
      value: formatCount(summary.improved),
      description: 'Meaningful favourable movement observed',
    },
    {
      key: 'met',
      label: 'Targets met',
      value: formatCount(summary.targetsMet),
      description: 'Separate from improvement status',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {impactSummaryItems.map((item) => (
        <Card key={item.key} size="sm" className="min-w-0 gap-2">
          <CardHeader>
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="text-2xl font-semibold tabular-nums">{item.value || EMPTY_VALUE}</p>
            <p className="text-xs break-words text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
