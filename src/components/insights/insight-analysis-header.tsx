import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import { CATEGORY_LABELS, STRENGTH_LABELS } from '@/data/hr-insight-rules'
import type { HrInsight } from '@/types/hr-insights'
import type { InsightPriority } from '@/types/hr-intelligence'
import {
  EMPTY_VALUE,
  formatCount,
  formatDelta,
  formatPercentage,
  formatScoreOutOf,
  isRateMetricLabel,
} from '@/utils/format'

type InsightAnalysisHeaderProps = {
  insight: HrInsight
  priority: InsightPriority
  privacySuppressed?: boolean
}

const metricValue = (insight: HrInsight, value: number | null | undefined): string =>
  value === null || value === undefined
    ? EMPTY_VALUE
    : isRateMetricLabel(insight.metricLabel)
      ? formatPercentage(value)
      : formatScoreOutOf(value, SCORE_SCALE.max)

const signalStatus = (insight: HrInsight): 'REVIEW' | 'VERIFY' | 'ONGOING' => {
  if (insight.signalStrength === 'strong') return 'REVIEW'
  if (insight.signalStrength === 'moderate') return 'VERIFY'
  return 'ONGOING'
}

export function InsightAnalysisHeader({
  insight,
  priority,
  privacySuppressed = false,
}: InsightAnalysisHeaderProps) {
  const summaryFields = [
    { key: 'scope', label: 'Affected', value: insight.affectedScope },
    ...(privacySuppressed
      ? [{ key: 'privacy', label: 'Evidence access', value: 'Insufficient responses' }]
      : [
          { key: 'metric', label: 'Current value', value: metricValue(insight, insight.currentValue) },
          { key: 'reference', label: 'Company benchmark', value: metricValue(insight, insight.referenceValue) },
        ]),
    {
      key: 'difference',
      label: 'Difference / variance',
      value:
        privacySuppressed || insight.difference === null || insight.difference === undefined
          ? EMPTY_VALUE
          : `${formatDelta(insight.difference)}${isRateMetricLabel(insight.metricLabel) ? ' pp' : ''}`,
    },
    { key: 'strength', label: 'Signal strength', value: STRENGTH_LABELS[insight.signalStrength] },
    { key: 'status', label: 'Signal status', value: signalStatus(insight) },
    {
      key: 'sample',
      label: 'Sample',
      value:
        privacySuppressed || insight.sampleSize === undefined
          ? EMPTY_VALUE
          : `${formatCount(insight.sampleSize)} ${insight.sampleLabel ?? 'records'}`,
    },
  ] as const

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <Link
          to="/insights"
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Insights
        </Link>
        <span aria-hidden="true" className="text-muted-foreground">
          /
        </span>
        <span className="text-foreground">Analysis</span>
      </nav>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABELS[insight.category]}
            </span>
            {insight.dataSources.length > 1 && !privacySuppressed ? (
              <Badge variant="outline">
                Evidence strength: {STRENGTH_LABELS[insight.signalStrength]} · {insight.dataSources.length} sources
              </Badge>
            ) : null}
            <span className="ml-auto">
              <PriorityBadge level={priority.level} score={priority.score} />
            </span>
          </div>
          <CardTitle className="text-xl leading-snug break-words">
            {privacySuppressed ? 'Workforce signal requires more responses' : insight.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {privacySuppressed
              ? 'Detailed group metrics and evidence are hidden until the minimum response threshold is met.'
              : insight.summary}
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-3 lg:grid-cols-6">
            {summaryFields.map(({ key, label, value }) => (
              <div key={key} className="min-w-0 space-y-0.5">
                <dt className="text-xs break-words text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium break-words tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {!privacySuppressed ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
              {insight.dataSources.map((source) => (
                <Badge key={source} variant="ghost" className="text-muted-foreground">
                  {source}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
