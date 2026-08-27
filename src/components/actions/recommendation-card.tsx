import { ArrowRight, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReviewStatusBadge } from '@/components/actions/action-status-badge'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TARGET_DISCLAIMER } from '@/data/hr-action-targets'
import type { RecommendedAction } from '@/types/hr-actions'
import { formatActionMetric } from '@/utils/hr-action-view'

type RecommendationCardProps = {
  recommendation: RecommendedAction
  onReview: (recommendation: RecommendedAction) => void
}

/**
 * One prioritised issue, the single intervention the engine recommends for it,
 * and the evidence behind that choice. Nothing on this card has happened yet:
 * every value is a suggestion until a human opens the review panel.
 */
export function RecommendationCard({ recommendation, onReview }: RecommendationCardProps) {
  const [open, setOpen] = useState(false)
  const isPending = recommendation.reviewStatus === 'pending-review'

  const facts = [
    { key: 'owner', label: 'Suggested owner', value: recommendation.suggestedOwner },
    {
      key: 'timeline',
      label: 'Suggested timeline',
      value: `${recommendation.suggestedDurationDays} days`,
    },
    {
      key: 'baseline',
      label: `Baseline · ${recommendation.baselineMetric.label}`,
      value: formatActionMetric(recommendation.baselineMetric),
    },
    {
      key: 'target',
      label: 'Suggested target',
      value: formatActionMetric(recommendation.suggestedTarget),
    },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge level={recommendation.priorityLevel} score={recommendation.priorityScore} />
          <Badge variant="outline">{recommendation.driverLabel}</Badge>
          <span className="ml-auto">
            {isPending ? null : <ReviewStatusBadge status={recommendation.reviewStatus} />}
          </span>
        </div>

        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {recommendation.issueTitle}
        </p>
        <CardTitle className="text-base leading-snug break-words">
          {recommendation.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">{recommendation.description}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div className="min-w-0 space-y-0.5">
            <dt className="text-xs text-muted-foreground">Affected scope</dt>
            <dd className="text-sm font-medium break-words">{recommendation.affectedScope}</dd>
          </div>
          {facts.map((fact) => (
            <div key={fact.key} className="min-w-0 space-y-0.5">
              <dt className="text-xs break-words text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm font-medium break-words tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="min-w-0 space-y-0.5 border-t pt-3">
          <p className="text-xs text-muted-foreground">Success measure</p>
          <p className="text-sm break-words">{recommendation.successMeasure}</p>
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border-t pt-3 text-sm font-medium transition-colors hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <span>{open ? 'Hide reasoning' : 'Why this action?'}</span>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">{recommendation.rationale}</p>
            <p className="text-xs text-muted-foreground">{TARGET_DISCLAIMER}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {recommendation.evidenceSources.map((source) => (
                <Badge key={source} variant="ghost" className="text-muted-foreground">
                  {source}
                </Badge>
              ))}
            </div>
            <Link
              to={`/insights/${recommendation.insightId}`}
              className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
            >
              View original analysis
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="sm" onClick={() => onReview(recommendation)}>
            {isPending ? 'Review action' : 'Reopen review'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
