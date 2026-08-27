import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IMPACT_RULES } from '@/data/hr-impact-rules'
import type { ImpactSummary as ImpactSummaryCounts } from '@/types/hr-impact'
import { EMPTY_VALUE, formatCount, formatPercentage } from '@/utils/format'

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
      key: 'tracked',
      label: 'Actions tracked',
      value: formatCount(summary.actionsTracked),
      description: 'Demo and official actions',
    },
    {
      key: 'measured',
      label: 'Measurements available',
      value: formatCount(summary.measurementsAvailable),
      description: 'A later reading exists',
    },
    {
      key: 'met',
      label: 'Targets met',
      value: formatCount(summary.targetsMet),
      description:
        summary.targetAchievementRate === null
          ? `Rate shown from ${IMPACT_RULES.minActionsForRate} judged actions`
          : `${formatPercentage(summary.targetAchievementRate, 0)} of judged actions`,
    },
    {
      key: 'awaiting',
      label: 'Awaiting measurement',
      value: formatCount(summary.awaitingMeasurement),
      description: 'No later reading yet',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
