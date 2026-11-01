import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReviewStatusBadge } from '@/components/actions/action-status-badge'
import {
  MetricComparison,
  MiniTrend,
  PriorityPanel,
  SupportingSignal,
} from '@/components/actions/recommendation-signal'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TARGET_DISCLAIMER } from '@/data/hr-action-targets'
import type { RecommendedAction } from '@/types/hr-actions'
import { formatActionMetric } from '@/utils/hr-action-view'
import type { RecommendationSignal } from '@/utils/hr-recommendation-view'
import { PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type RecommendationCardProps = {
  recommendation: RecommendedAction
  /** Prepared issue data; `null` for recommendations that have no priority issue. */
  signal: RecommendationSignal | null
  onReview: (recommendation: RecommendedAction) => void
  privacySuppressed?: boolean
}

/**
 * One prioritised issue, the single intervention the engine recommends for it,
 * and the evidence behind that choice. Level 1 (signal, priority, action, owner)
 * is readable at a glance; Level 2 (evidence details) stays collapsed. Nothing
 * here has happened yet: every value is a suggestion until HR opens the review.
 */
export function RecommendationCard({
  recommendation,
  signal,
  onReview,
  privacySuppressed = false,
}: RecommendationCardProps) {
  const [open, setOpen] = useState(false)
  const isPending = recommendation.reviewStatus === 'pending-review'
  const sourceCount = recommendation.evidenceSources.length
  const sourceLabel = `${sourceCount} source${sourceCount === 1 ? '' : 's'}`

  return (
    <article className="min-w-0 space-y-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {privacySuppressed ? <PriorityBadge level={recommendation.priorityLevel} /> : null}
          {isPending ? null : <ReviewStatusBadge status={recommendation.reviewStatus} />}
          <span className="text-xs font-medium text-muted-foreground">{recommendation.affectedScope}</span>
          {isPending ? (
            <span className="ml-auto text-xs text-muted-foreground">Suggested · Requires HR approval</span>
          ) : null}
        </div>
        <h3 className="text-base leading-snug font-semibold break-words">{recommendation.issueTitle}</h3>
      </header>

      {privacySuppressed ? (
        <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
          {PRIVACY_SUPPRESSED_MESSAGE}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
            <div className="min-w-0 space-y-4 lg:col-span-3">
              {signal ? (
                <>
                  <MetricComparison signal={signal} />
                  {signal.trend ? <MiniTrend trend={signal.trend} /> : null}
                  <p className="line-clamp-2 text-sm text-muted-foreground">{signal.keySignal}</p>
                  {signal.supporting ? <SupportingSignal supporting={signal.supporting} /> : null}
                </>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{recommendation.baselineMetric.label}</p>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {formatActionMetric(recommendation.baselineMetric)}
                  </p>
                  <p className="text-xs text-muted-foreground">{recommendation.driverLabel}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Evidence</span>
                {recommendation.evidenceSources.map((source) => (
                  <Badge key={source} variant="outline">{source}</Badge>
                ))}
                {signal ? (
                  <span className="text-xs text-muted-foreground capitalize">· {signal.strength}</span>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 lg:col-span-2 lg:border-l lg:pl-8">
              <PriorityPanel
                score={recommendation.priorityScore}
                level={recommendation.priorityLevel}
                factors={signal?.factors ?? []}
              />
            </div>
          </div>

          <section className="space-y-3 border-t pt-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">Recommended action</p>
            <div className="space-y-1">
              <h4 className="text-base leading-snug font-medium break-words">{recommendation.title}</h4>
              <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground">{recommendation.description}</p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Owner</dt>
                  <dd className="text-sm font-medium break-words">{recommendation.suggestedOwner}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Timeline</dt>
                  <dd className="text-sm font-medium tabular-nums">{recommendation.suggestedDurationDays} days</dd>
                </div>
              </dl>
              {isPending ? (
                <Button size="sm" onClick={() => onReview(recommendation)}>
                  Review action
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </section>

          <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-muted/30 p-3">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-sm font-medium transition-colors hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
              <span className="flex min-w-0 items-center gap-2">
                <span>{open ? 'Hide evidence details' : 'Evidence details'}</span>
                <span className="text-xs font-normal text-muted-foreground">{sourceLabel}</span>
              </span>
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 border-t pt-3">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Baseline · {recommendation.baselineMetric.label}</dt>
                  <dd className="text-sm font-medium break-words tabular-nums">{formatActionMetric(recommendation.baselineMetric)}</dd>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Suggested target</dt>
                  <dd className="text-sm font-medium break-words tabular-nums">{formatActionMetric(recommendation.suggestedTarget)}</dd>
                </div>
              </dl>
              <div className="space-y-1 border-t pt-3 text-sm">
                <p className="text-xs text-muted-foreground">Success measure</p>
                <p className="break-words">{recommendation.successMeasure}</p>
              </div>
              <div className="space-y-1 border-t pt-3 text-sm">
                <p className="text-xs text-muted-foreground">Why this action?</p>
                <p className="break-words text-muted-foreground">{recommendation.rationale}</p>
              </div>
              <p className="text-xs text-muted-foreground">{TARGET_DISCLAIMER}</p>
              <Link
                to={recommendation.insightId
                  ? `/insights/${recommendation.insightId}`
                  : '/insights'}
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
              >
                {recommendation.insightId ? 'View original analysis' : 'View priority analysis'}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </article>
  )
}
