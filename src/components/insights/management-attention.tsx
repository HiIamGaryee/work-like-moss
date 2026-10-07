import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import { isInsightDetailSuppressed } from '@/utils/insight-privacy'
import { EMPTY_VALUE, formatCount, formatPercentage, formatScoreOutOf } from '@/utils/format'

type ManagementAttentionProps = {
  items: HrIntelligenceItem[]
  analytics?: HrAnalytics | null
  groupOnly?: boolean
  alwaysVisible?: boolean
}

const metricValue = (item: HrIntelligenceItem): string => {
  const { insight } = item
  if (insight.currentValue === null || insight.currentValue === undefined) return EMPTY_VALUE
  const isRate =
    insight.metricLabel.toLowerCase().includes('rate') ||
    insight.metricLabel.toLowerCase().includes('share')
  return isRate
    ? formatPercentage(insight.currentValue)
    : formatScoreOutOf(insight.currentValue, SCORE_SCALE.max)
}

const isGroupSignal = (item: HrIntelligenceItem): boolean =>
  item.insight.scope.kind === 'division' || item.insight.scope.kind === 'employee-group'

const signalStatus = (item: HrIntelligenceItem): 'REVIEW' | 'VERIFY' | 'ONGOING' => {
  if (item.insight.signalStrength === 'strong') return 'REVIEW'
  if (item.insight.signalStrength === 'moderate') return 'VERIFY'
  return 'ONGOING'
}

const statusVariant = (status: ReturnType<typeof signalStatus>): 'default' | 'secondary' | 'outline' => {
  if (status === 'REVIEW') return 'default'
  if (status === 'VERIFY') return 'secondary'
  return 'outline'
}

const benchmarkValue = (item: HrIntelligenceItem): string => {
  const value = item.insight.referenceValue
  if (value === null || value === undefined) return EMPTY_VALUE
  const isRate = /rate|share/i.test(item.insight.metricLabel)
  return isRate ? formatPercentage(value) : formatScoreOutOf(value, SCORE_SCALE.max)
}

/**
 * The highest-priority issues, in priority order. No recommended action —
 * this points management at what to review, and stops there.
 */
export function ManagementAttention({
  items,
  analytics = null,
  groupOnly = false,
  alwaysVisible = false,
}: ManagementAttentionProps) {
  const shownItems = groupOnly ? items.filter(isGroupSignal) : items
  if (shownItems.length === 0 && !alwaysVisible) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Management Attention</CardTitle>
        <CardDescription>
          {groupOnly
            ? 'Prioritised division and employee-group signals requiring HR review.'
            : 'Highest-priority detected issues. Requires management review.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {shownItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No division or employee-group signals currently require review.
          </p>
        ) : null}
        {shownItems.map((item, index) => {
          const topDriver = item.likelyDrivers[0] ?? null
          const suppressed = isInsightDetailSuppressed(item, analytics)
          const status = signalStatus(item)
          return (
            <Link
              key={item.insight.id}
              to={`/insights/${item.insight.id}`}
              className="block rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <PriorityBadge level={item.priority.level} score={suppressed ? undefined : item.priority.score} />
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  View signal
                  <ArrowRight className="size-3" aria-hidden="true" />
                </span>
              </div>

              <p className="mt-1.5 text-sm font-medium break-words">{item.insight.title}</p>

              {suppressed ? (
                <p className="mt-2 text-sm text-muted-foreground">Insufficient responses</p>
              ) : (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">Affected</dt>
                    <dd className="text-sm break-words">{item.insight.affectedScope}</dd>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs break-words text-muted-foreground">Current value</dt>
                    <dd className="text-sm tabular-nums">{metricValue(item)}</dd>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs break-words text-muted-foreground">Company benchmark</dt>
                    <dd className="text-sm tabular-nums">{benchmarkValue(item)}</dd>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">Sample</dt>
                    <dd className="text-sm tabular-nums">
                      {item.insight.sampleSize === undefined ? EMPTY_VALUE : formatCount(item.insight.sampleSize)}
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">Evidence</dt>
                    <dd className="text-sm tabular-nums">{formatCount(item.insight.dataSources.length)} sources</dd>
                  </div>
                </dl>
              )}
              {!suppressed && topDriver ? (
                <p className="mt-2 text-xs text-muted-foreground">Likely driver: {topDriver.label}</p>
              ) : null}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
