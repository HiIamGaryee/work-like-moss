import { Link } from 'react-router-dom'
import { ActionStatusBadge } from '@/components/actions/action-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ACTION_REMINDER_LABELS, actionReminderState } from '@/data/hr-automation-rules'
import type { ActionExecutionStatus, HrAction } from '@/types/hr-actions'
import { formatDate } from '@/utils/format'
import { formatActionMetric, formatDueWindow, isActionOverdue } from '@/utils/hr-action-view'

type ActiveActionCardProps = {
  action: HrAction
  today: string
  onStatusChange: (actionId: string, status: ActionExecutionStatus) => void
  onOpenDetail: (action: HrAction) => void
}

/**
 * An approved demo action. Everything accountable is on the face of the card:
 * what happens, who owns it, when it is due, and what HR plans to check.
 */
export function ActiveActionCard({
  action,
  today,
  onStatusChange,
  onOpenDetail,
}: ActiveActionCardProps) {
  const overdue = isActionOverdue(action, today)
  /*
   * The same rule the Attention Inbox uses, so the two surfaces can never
   * disagree about whether a deadline is close. Nothing is calculated twice.
   */
  const reminder = actionReminderState(action, today)

  const facts = [
    { key: 'owner', label: 'Owner', value: action.owner },
    { key: 'due', label: 'Due date', value: formatDate(action.dueDate) },
    { key: 'window', label: 'Timeline', value: formatDueWindow(action, today) },
    {
      key: 'target',
      label: 'Baseline → target',
      value: `${formatActionMetric(action.baselineMetric)} → ${formatActionMetric(action.targetMetric)}`,
    },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <ActionStatusBadge status={action.status} isOverdue={overdue} />
          {reminder ? (
            <Badge variant="secondary" className="shrink-0">
              {ACTION_REMINDER_LABELS[reminder]}
            </Badge>
          ) : null}
          {action.editedByHr ? (
            <Badge variant="outline" className="shrink-0">
              Edited by HR
            </Badge>
          ) : null}
        </div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {action.issueTitle}
        </p>
        <CardTitle className="text-base leading-snug break-words">{action.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.key} className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm font-medium break-words tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="min-w-0 space-y-0.5 border-t pt-3">
          <p className="text-xs text-muted-foreground">Success measure</p>
          <p className="text-sm break-words">{action.successMeasure}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          {action.status === 'planned' ? (
            <Button size="sm" onClick={() => onStatusChange(action.id, 'in-progress')}>
              Start Action
            </Button>
          ) : null}
          {action.status === 'in-progress' ? (
            <Button size="sm" onClick={() => onStatusChange(action.id, 'completed')}>
              Mark Complete
            </Button>
          ) : null}
          {action.status === 'planned' || action.status === 'in-progress' ? (
            <Button variant="ghost" size="sm" onClick={() => onStatusChange(action.id, 'cancelled')}>
              Cancel Action
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => onOpenDetail(action)}>
            View details
          </Button>
          {/* Only offered where a baseline and metric were actually recorded. */}
          {action.impactMetricKey ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/impact?action=${action.id}`}>View impact</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
