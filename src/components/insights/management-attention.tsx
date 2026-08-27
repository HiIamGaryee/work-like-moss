import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import { EMPTY_VALUE, formatPercentage, formatScoreOutOf } from '@/utils/format'

type ManagementAttentionProps = {
  items: HrIntelligenceItem[]
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

/**
 * The highest-priority issues, in priority order. No recommended action —
 * this points management at what to review, and stops there.
 */
export function ManagementAttention({ items }: ManagementAttentionProps) {
  if (items.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Management Attention</CardTitle>
        <CardDescription>
          Highest-priority detected issues. Requires management review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => {
          const topDriver = item.likelyDrivers[0] ?? null
          return (
            <Link
              key={item.insight.id}
              to={`/insights/${item.insight.id}`}
              className="block rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <PriorityBadge level={item.priority.level} score={item.priority.score} />
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  View analysis
                  <ArrowRight className="size-3" aria-hidden="true" />
                </span>
              </div>

              <p className="mt-1.5 text-sm font-medium break-words">{item.insight.title}</p>

              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Affected</dt>
                  <dd className="text-sm break-words">{item.insight.affectedScope}</dd>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs break-words text-muted-foreground">
                    {item.insight.metricLabel}
                  </dt>
                  <dd className="text-sm tabular-nums">{metricValue(item)}</dd>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Top likely driver</dt>
                  <dd className="text-sm break-words">{topDriver?.label ?? EMPTY_VALUE}</dd>
                </div>
              </dl>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
