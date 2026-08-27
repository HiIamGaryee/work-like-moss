import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionStatusBadge } from '@/components/actions/action-status-badge'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { HrAction } from '@/types/hr-actions'
import { EMPTY_VALUE, formatDate } from '@/utils/format'
import { formatActionMetric, formatDueWindow, isActionOverdue } from '@/utils/hr-action-view'

type ActionDetailSheetProps = {
  action: HrAction | null
  today: string
  onClose: () => void
}

/**
 * Read-only detail for one approved action. Completion means the action was
 * performed — never that it worked. No impact is claimed anywhere on this panel.
 */
export function ActionDetailSheet({ action, today, onClose }: ActionDetailSheetProps) {
  if (!action) return null

  const fields = [
    { key: 'issue', label: 'Linked issue', value: action.issueTitle || EMPTY_VALUE },
    { key: 'scope', label: 'Affected scope', value: action.affectedScope || EMPTY_VALUE },
    { key: 'owner', label: 'Owner', value: action.owner },
    { key: 'start', label: 'Start date', value: formatDate(action.startDate) },
    { key: 'due', label: 'Due date', value: formatDate(action.dueDate) },
    { key: 'window', label: 'Timeline', value: formatDueWindow(action, today) },
    {
      key: 'baseline',
      label: `Baseline · ${action.baselineMetric?.label ?? 'measure'}`,
      value: formatActionMetric(action.baselineMetric),
    },
    { key: 'target', label: 'Target', value: formatActionMetric(action.targetMetric) },
    { key: 'created', label: 'Approved on', value: formatDate(action.createdAt.slice(0, 10)) },
    {
      key: 'completed',
      label: 'Marked completed',
      value: action.completedAt ? formatDate(action.completedAt.slice(0, 10)) : EMPTY_VALUE,
    },
  ]

  return (
    <Sheet open onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        aria-describedby="detail-description"
      >
        <SheetHeader className="pr-12">
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <ActionStatusBadge status={action.status} isOverdue={isActionOverdue(action, today)} />
            {action.priorityLevelAtCreation ? (
              <PriorityBadge
                level={action.priorityLevelAtCreation}
                score={action.priorityScoreAtCreation}
              />
            ) : null}
            {action.editedByHr ? <Badge variant="outline">Edited by HR</Badge> : null}
          </div>
          <SheetTitle className="break-words">{action.title}</SheetTitle>
          <SheetDescription id="detail-description">
            Priority shown is the issue's score when this action was approved.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          {action.description ? (
            <p className="text-sm text-muted-foreground">{action.description}</p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {fields.map((field) => (
              <div key={field.key} className="min-w-0 space-y-0.5">
                <dt className="text-xs break-words text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium break-words tabular-nums">{field.value}</dd>
              </div>
            ))}
          </dl>

          <Separator />

          <section className="space-y-1">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Success measure
            </h3>
            <p className="text-sm break-words">{action.successMeasure}</p>
            <p className="text-xs text-muted-foreground">
              Marking an action completed records that it was performed. Whether it worked is
              measured separately, against the next survey wave.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {action.insightId ? (
              <Link
                to={`/insights/${action.insightId}`}
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
              >
                View original analysis
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            {action.impactMetricKey ? (
              <Link
                to={`/impact?action=${action.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
              >
                View impact
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
