import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORY_LABELS, STRENGTH_LABELS } from '@/data/hr-insight-rules'
import type { InsightSummary } from '@/types/hr-insights'
import { formatCount } from '@/utils/format'

type InsightOverviewProps = {
  summary: InsightSummary
  latestWave: string | null
}

/**
 * Counts only. The narrative line is assembled from those counts, so it can
 * never overstate what the engine found.
 */
export function InsightOverview({ summary, latestWave }: InsightOverviewProps) {
  const summaryItems = [
    {
      key: 'signals',
      label: 'Signals detected',
      value: formatCount(summary.totalSignals),
      description: `Across ${summary.categoryCounts.length} categories`,
    },
    {
      key: 'strong',
      label: 'Strong signals',
      value: formatCount(summary.strongSignals),
      description: `${summary.moderateSignals} moderate · ${summary.watchSignals} watch`,
    },
    {
      key: 'sources',
      label: 'Data sources',
      value: formatCount(summary.dataSourceCount),
      description: `${summary.crossSourceSignals} signals span more than one`,
    },
    {
      key: 'wave',
      label: 'Latest pulse wave',
      value: latestWave ?? '—',
      description: 'Most recent wave in the dataset',
    },
  ] as const

  const strengthLine =
    summary.crossSourceSignals > 0
      ? `${summary.crossSourceSignals} ${summary.crossSourceSignals === 1 ? 'signal is' : 'signals are'} supported by more than one workforce measure.`
      : 'Each signal is supported by a single workforce measure.'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map(({ key, label, value, description }) => (
          <Card key={key} size="sm" className="gap-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Workforce Signals</CardTitle>
          <CardDescription>
            {summary.totalSignals} {summary.totalSignals === 1 ? 'signal' : 'signals'} detected
            across {summary.categoryCounts.length}{' '}
            {summary.categoryCounts.length === 1 ? 'category' : 'categories'}. {strengthLine}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            {summary.categoryCounts.map(({ category, count }) => (
              <div key={category} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">{CATEGORY_LABELS[category]}</dt>
                <dd className="text-base font-medium tabular-nums">{count}</dd>
              </div>
            ))}
            <div className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">{STRENGTH_LABELS.strong}</dt>
              <dd className="text-base font-medium tabular-nums">{summary.strongSignals}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
