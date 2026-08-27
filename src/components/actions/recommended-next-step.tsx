import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionStatusBadge, ReviewStatusBadge } from '@/components/actions/action-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MeasurementStatusBadge } from '@/components/impact/impact-status-badge'
import type { HrAction, RecommendedAction } from '@/types/hr-actions'
import type { MeasurementStatus } from '@/types/hr-impact'
import { todayIsoDate } from '@/utils/date'
import { formatDate } from '@/utils/format'
import { formatActionMetric, isActionOverdue } from '@/utils/hr-action-view'

type RecommendedNextStepProps = {
  recommendation: RecommendedAction
  action: HrAction | null
  /** Present once the approved action is tracked by the Impact Tracker. */
  measurementStatus?: MeasurementStatus
}

/** What the link offers depends on what HR has already decided about this issue. */
const LINK_LABELS = {
  'pending-review': 'Review in Action Centre',
  approved: 'View active action',
  rejected: 'Open in Action Centre',
} as const

/**
 * Closes the loop on the analysis page: the issue has been detected, explained
 * and prioritised, and this is the one intervention the engine recommends for
 * it. The decision itself belongs to the Action Centre, never to this page.
 */
export function RecommendedNextStep({
  recommendation,
  action,
  measurementStatus,
}: RecommendedNextStepProps) {
  const today = todayIsoDate()
  const status = recommendation.reviewStatus

  const fields =
    action !== null
      ? [
          { key: 'owner', label: 'Owner', value: action.owner },
          { key: 'due', label: 'Due date', value: formatDate(action.dueDate) },
          {
            key: 'target',
            label: 'Baseline → target',
            value: `${formatActionMetric(action.baselineMetric)} → ${formatActionMetric(action.targetMetric)}`,
          },
        ]
      : [
          { key: 'owner', label: 'Suggested owner', value: recommendation.suggestedOwner },
          {
            key: 'timeline',
            label: 'Suggested timeline',
            value: `${recommendation.suggestedDurationDays} days`,
          },
          {
            key: 'target',
            label: 'Baseline → suggested target',
            value: `${formatActionMetric(recommendation.baselineMetric)} → ${formatActionMetric(recommendation.suggestedTarget)}`,
          },
        ]

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Recommended Next Step</CardTitle>
          <span className="ml-auto flex items-center gap-1.5">
            {action ? (
              <>
                <Badge variant="outline">Action created</Badge>
                <ActionStatusBadge
                  status={action.status}
                  isOverdue={isActionOverdue(action, today)}
                />
                {measurementStatus ? <MeasurementStatusBadge status={measurementStatus} /> : null}
              </>
            ) : (
              <ReviewStatusBadge status={status} />
            )}
          </span>
        </div>
        <CardDescription>
          The system suggests one intervention per issue. A person reviews and approves it before
          anything is tracked.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium break-words">{action?.title ?? recommendation.title}</p>
          <p className="text-sm text-muted-foreground">
            {action?.description ?? recommendation.description}
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-3">
          {fields.map((field) => (
            <div key={field.key} className="min-w-0 space-y-0.5">
              <dt className="text-xs break-words text-muted-foreground">{field.label}</dt>
              <dd className="text-sm font-medium break-words tabular-nums">{field.value}</dd>
            </div>
          ))}
        </dl>

        <div className="min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">Success measure</p>
          <p className="text-sm break-words">
            {action?.successMeasure ?? recommendation.successMeasure}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/actions?recommendation=${recommendation.id}`}>
              {LINK_LABELS[status]}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          {/* Closes the loop: the same issue, all the way through to measurement. */}
          {action?.impactMetricKey ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/impact?action=${action.id}`}>
                View impact
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
