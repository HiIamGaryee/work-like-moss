import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReviewStatusBadge } from '@/components/actions/action-status-badge'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TARGET_DISCLAIMER } from '@/data/hr-action-targets'
import type { RecommendedAction } from '@/types/hr-actions'
import { formatActionMetric } from '@/utils/hr-action-view'
import { PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type RecommendationCardProps = {
  recommendation: RecommendedAction
  onReview: (recommendation: RecommendedAction) => void
  privacySuppressed?: boolean
}

/**
 * One prioritised issue, the single intervention the engine recommends for it,
 * and the evidence behind that choice. Nothing on this card has happened yet:
 * every value is a suggestion until a human opens the review panel.
 */
export function RecommendationCard({ recommendation, onReview, privacySuppressed = false }: RecommendationCardProps) {
  const [open, setOpen] = useState(false)
  const isPending = recommendation.reviewStatus === 'pending-review'

  const facts = [
    { key: 'scope', label: 'Affected scope', value: recommendation.affectedScope },
    { key: 'owner', label: 'Suggested owner', value: recommendation.suggestedOwner },
    {
      key: 'timeline',
      label: 'Timeline',
      value: `${recommendation.suggestedDurationDays} days`,
    },
  ]

  return (
    <article className="group min-w-0 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <CardHeader className="space-y-3 px-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <PriorityBadge level={recommendation.priorityLevel} />
            <Badge variant="outline">{recommendation.driverLabel}</Badge>
            {isPending ? null : <ReviewStatusBadge status={recommendation.reviewStatus} />}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 text-muted-foreground">
            {!privacySuppressed ? (
              <span
                className="flex size-7 items-center justify-center rounded-full bg-amber-300 text-xs font-semibold text-amber-950 tabular-nums"
                aria-label={`Priority score ${recommendation.priorityScore} out of 100`}
              >
                {recommendation.priorityScore}
              </span>
            ) : null}
            <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
        </div>

        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {recommendation.issueTitle}
        </p>
        <CardTitle className="text-base leading-snug break-words">
          {recommendation.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-0 pt-0">
        {isPending ? (
          <p className="text-xs text-muted-foreground">System recommendation · HR approval required</p>
        ) : null}
        <p className="line-clamp-2 max-w-4xl text-sm text-muted-foreground">{recommendation.description}</p>

        {privacySuppressed ? <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">{PRIVACY_SUPPRESSED_MESSAGE}</p> : <dl className="grid grid-cols-1 gap-4 border-y py-4 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.key} className="min-w-0 space-y-0.5">
              <dt className="text-xs break-words text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm font-medium break-words tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>}

        {!privacySuppressed ? <div className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">
            Based on {recommendation.evidenceSources.length} evidence source{recommendation.evidenceSources.length === 1 ? '' : 's'}
          </p>
        </div> : null}

        {!privacySuppressed ? <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-muted/30 p-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-sm font-medium transition-colors hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <span className="flex min-w-0 items-center gap-2">
              <span>{open ? 'Hide evidence details' : 'Evidence details'}</span>
              <span className="text-xs font-normal text-muted-foreground">{recommendation.evidenceSources.length} source{recommendation.evidenceSources.length === 1 ? '' : 's'}</span>
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
            <div className="flex flex-wrap gap-1.5 border-t pt-3">
              {recommendation.evidenceSources.map((source) => (
                <Badge key={source} variant="outline">{source}</Badge>
              ))}
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
        </Collapsible> : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
          {isPending && !privacySuppressed ? (
            <Button size="sm" onClick={() => onReview(recommendation)}>
              Review action
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </article>
  )
}
