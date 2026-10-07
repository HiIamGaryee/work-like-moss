import { CalendarClock, CheckCircle2, CircleAlert, MessageSquare, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/utils/format'
import type { FollowUpStatus, FollowUpType, HrAutomationItem, HrFollowUpItem } from '@/types/hr-automation'

type FollowUpQueueProps = {
  items: HrFollowUpItem[]
  onReviewMessage: (item: HrAutomationItem) => void
  onStatusChange: (id: string, status: FollowUpStatus) => void
}

const TYPE_LABELS: Record<FollowUpType, string> = {
  'employee-care': 'Employee care',
  'onboarding-check-in': 'Onboarding check-in',
  'action-review': 'Action review',
  'overdue-action': 'Overdue action',
  'delivery-follow-up': 'Delivery follow-up',
  'hr-review': 'HR review',
  'message-review': 'Message review',
  'outcome-review': 'Outcome review',
}

const STATUS_LABELS: Record<FollowUpStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  completed: 'Completed',
  dismissed: 'Dismissed',
}

const PRIORITY_VARIANTS = {
  overdue: 'destructive',
  today: 'default',
  upcoming: 'secondary',
  attention: 'outline',
} as const

export function FollowUpQueue({ items, onReviewMessage, onStatusChange }: FollowUpQueueProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No HR follow-ups require attention right now.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const automation = item.automation
        const isClosed = item.status === 'completed' || item.status === 'dismissed'
        const canComplete = item.type !== 'hr-review'
        return (
          <Card key={item.id} className="min-w-0">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {item.priority === 'overdue' ? <CircleAlert className="size-3.5" aria-hidden="true" /> : <CalendarClock className="size-3.5" aria-hidden="true" />}
                  {TYPE_LABELS[item.type]}
                </span>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  <Badge variant={PRIORITY_VARIANTS[item.priority]}>{item.priority === 'overdue' ? 'Overdue' : item.priority === 'today' ? 'Due today' : item.priority === 'upcoming' ? 'Due soon' : 'Normal'}</Badge>
                  <Badge variant="outline">{STATUS_LABELS[item.status]}</Badge>
                </span>
              </div>
              <CardTitle className="text-base leading-snug break-words">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{item.description}</p>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {item.affectedGroup ? <div><dt className="text-xs text-muted-foreground">Group</dt><dd className="text-sm font-medium break-words">{item.affectedGroup}</dd></div> : null}
                {item.owner ? <div><dt className="text-xs text-muted-foreground">Owner</dt><dd className="text-sm font-medium break-words">{item.owner}</dd></div> : null}
                {item.dueDate ? <div><dt className="text-xs text-muted-foreground">Due</dt><dd className="text-sm font-medium">{formatDate(item.dueDate)}</dd></div> : null}
                {automation?.employeeName ? <div><dt className="text-xs text-muted-foreground">Operational reference</dt><dd className="text-sm font-medium break-words">{automation.employeeName}</dd></div> : null}
              </dl>

              {item.messageReviewAvailable && automation ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                  <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Draft message waiting for human review.</span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {item.linkTo ? <Button variant="outline" size="sm" asChild><Link to={item.linkTo}>{item.linkLabel ?? 'Open'}</Link></Button> : null}
                {item.messageReviewAvailable && automation ? <Button size="sm" onClick={() => onReviewMessage(automation)}>Review message</Button> : null}
                {isClosed ? (
                  <Button variant="ghost" size="sm" onClick={() => onStatusChange(item.id, 'open')}><RotateCcw className="mr-1.5 size-4" aria-hidden="true" />Reopen</Button>
                ) : (
                  <>
                    {canComplete ? <Button size="sm" onClick={() => onStatusChange(item.id, 'completed')}><CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />Mark complete</Button> : null}
                    <Button variant="ghost" size="sm" onClick={() => onStatusChange(item.id, 'dismissed')}>Dismiss</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
