import {
  Activity,
  ArrowRight,
  ChevronDown,
  Gauge,
  HeartHandshake,
  LogOut,
  TrendingUp,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { InsightEvidenceList } from '@/components/insights/insight-evidence-list'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CATEGORY_LABELS, STRENGTH_LABELS } from '@/data/hr-insight-rules'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { HrInsight, InsightCategory } from '@/types/hr-insights'
import type { HrAnalytics } from '@/types/hr-analytics'
import { isInsightDetailSuppressed } from '@/utils/insight-privacy'
import type { InsightPriority } from '@/types/hr-intelligence'
import {
  formatCount,
  formatDelta,
  formatPercentage,
  formatScoreOutOf,
  isRateMetricLabel,
} from '@/utils/format'

type InsightCardProps = {
  insight: HrInsight
  priority: InsightPriority
  topDriverLabel: string | null
  analytics: HrAnalytics | null
}

const CATEGORY_ICONS: Record<InsightCategory, ComponentType<{ className?: string }>> = {
  engagement: Activity,
  retention: UserMinus,
  onboarding: UserPlus,
  'manager-support': UsersRound,
  'career-growth': TrendingUp,
  workload: Gauge,
  belonging: HeartHandshake,
  exit: LogOut,
}

function formatMetric(insight: HrInsight, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return isRateMetricLabel(insight.metricLabel) ? formatPercentage(value) : formatScoreOutOf(value, SCORE_SCALE.max)
}

/** Rate gaps are percentage points; score gaps are points on the 1–5 scale. */
function formatDifference(insight: HrInsight, value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return isRateMetricLabel(insight.metricLabel) ? `${formatDelta(value)} pp` : formatDelta(value)
}

export function InsightCard({ insight, priority, topDriverLabel, analytics }: InsightCardProps) {
  const [open, setOpen] = useState(false)
  const CategoryIcon = CATEGORY_ICONS[insight.category]
  const crossSource = insight.dataSources.length > 1
  const suppressed = isInsightDetailSuppressed({ insight }, analytics)

  return (
    <Card className="min-w-0 transition-colors hover:bg-muted/30">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <CategoryIcon className="size-3.5" aria-hidden="true" />
            {CATEGORY_LABELS[insight.category]}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {crossSource ? <Badge variant="outline">Cross-source signal</Badge> : null}
            <PriorityBadge level={priority.level} score={suppressed ? undefined : priority.score} />
          </span>
        </div>
        <CardTitle className="text-base leading-snug">{insight.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">{insight.summary}</p>

        {suppressed ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Insufficient responses. Detailed analytics hidden to protect employee privacy.
          </p>
        ) : <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div className="min-w-0 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Affected</dt>
            <dd className="text-sm font-medium break-words">{insight.affectedScope}</dd>
          </div>
          <div className="min-w-0 space-y-0.5">
            <dt className="text-xs text-muted-foreground break-words">{insight.metricLabel}</dt>
            <dd className="text-sm font-medium tabular-nums">
              {formatMetric(insight, insight.currentValue)}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Compared with</dt>
            <dd className="text-sm font-medium tabular-nums">
              {formatMetric(insight, insight.referenceValue)}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">Difference</dt>
            <dd className="text-sm font-medium tabular-nums">
              {formatDifference(insight, insight.difference)}
            </dd>
          </div>
        </dl>}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Top likely driver</dt>
            <dd className="text-sm font-medium break-words">{suppressed ? 'Insufficient responses' : topDriverLabel ?? '—'}</dd>
          </div>
          {!suppressed && insight.sampleSize !== undefined ? (
            <div className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">Sample</dt>
              <dd className="text-sm break-words">
                {formatCount(insight.sampleSize)} {insight.sampleLabel ?? 'records'}
              </dd>
            </div>
          ) : null}
        </dl>

        {!suppressed ? <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border-t pt-3 text-sm font-medium transition-colors hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <span>{open ? 'Hide evidence' : 'View evidence'}</span>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">
            <section className="space-y-1">
              <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Detected because
              </h4>
              <p className="text-sm text-muted-foreground">{insight.detectionRule}</p>
              <p className="text-xs text-muted-foreground">
                Signal strength: {STRENGTH_LABELS[insight.signalStrength]} — how much measurement
                backs the finding, separate from its review priority.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Evidence
              </h4>
              <InsightEvidenceList evidence={insight.evidence} />
            </section>
          </CollapsibleContent>
        </Collapsible> : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t pt-3">
          {insight.dataSources.map((source) => (
            <Badge key={source} variant="ghost" className="text-muted-foreground">
              {source}
            </Badge>
          ))}
          <Link
            to={`/insights/${insight.id}`}
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
          >
            View signal
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
