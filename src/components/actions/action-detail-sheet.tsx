import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionStatusBadge } from '@/components/actions/action-status-badge'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ACTION_DELIVERY_STATUS_LABELS } from '@/data/hr-action-catalog'
import type {
  ActionAssignmentDraft,
  ActionDeliveryDraft,
  ActionDeliveryStatus,
  HrAction,
} from '@/types/hr-actions'
import { isBefore, isValidIsoDate } from '@/utils/date'
import { EMPTY_VALUE, formatDate } from '@/utils/format'
import { formatActionMetric, formatDueWindow, isActionOverdue } from '@/utils/hr-action-view'
import { PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type ActionDetailSheetProps = {
  action: HrAction | null
  today: string
  onClose: () => void
  onUpdateAssignment: (actionId: string, draft: ActionAssignmentDraft) => void
  onUpdateDelivery: (actionId: string, draft: ActionDeliveryDraft) => void
  privacySuppressed?: boolean
}

function AssignmentEditor({
  action,
  onSave,
}: {
  action: HrAction
  onSave: (actionId: string, draft: ActionAssignmentDraft) => void
}) {
  const [owner, setOwner] = useState(action.owner)
  const [dueDate, setDueDate] = useState(action.dueDate)
  const valid = owner.trim().length > 0 && isValidIsoDate(dueDate) &&
    !isBefore(dueDate, action.startDate)
  const unchanged = owner.trim() === action.owner && dueDate === action.dueDate

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-medium">Owner and due date</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`assignment-owner-${action.id}`}>Owner</Label>
          <Input
            id={`assignment-owner-${action.id}`}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`assignment-due-${action.id}`}>Due date</Label>
          <Input
            id={`assignment-due-${action.id}`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!valid || unchanged}
        onClick={() => onSave(action.id, { owner: owner.trim(), dueDate })}
      >
        Save assignment
      </Button>
      {!valid ? (
        <p className="text-xs text-muted-foreground">
          Enter an owner and a valid due date on or after the start date.
        </p>
      ) : null}
    </section>
  )
}

const DELIVERY_STATUSES = Object.entries(ACTION_DELIVERY_STATUS_LABELS) as [ActionDeliveryStatus, string][]

function DeliveryEditor({
  action,
  onSave,
}: {
  action: HrAction
  onSave: (actionId: string, draft: ActionDeliveryDraft) => void
}) {
  const current = action.delivery
  const [status, setStatus] = useState<ActionDeliveryStatus>(current?.status ?? 'not-started')
  const [deliveryDate, setDeliveryDate] = useState(current?.deliveryDate ?? '')
  const [affectedGroup, setAffectedGroup] = useState(current?.affectedGroup ?? action.affectedScope)
  const [intended, setIntended] = useState(current?.intendedAudienceCount?.toString() ?? '')
  const [reached, setReached] = useState(current?.reachedAudienceCount?.toString() ?? '')
  const [deliveryNote, setDeliveryNote] = useState(current?.deliveryNote ?? '')

  const intendedCount = intended.trim() === '' ? undefined : Number(intended)
  const reachedCount = reached.trim() === '' ? undefined : Number(reached)
  const validCount = (value: number | undefined): boolean =>
    value === undefined || (Number.isInteger(value) && value >= 0)
  const requiresGroup = status !== 'not-started' && status !== 'cancelled'
  const requiresDate = status === 'delivered' || status === 'partially-delivered'
  const valid = (!requiresGroup || affectedGroup.trim() !== '') &&
    (!requiresDate || isValidIsoDate(deliveryDate)) &&
    validCount(intendedCount) && validCount(reachedCount) &&
    (intendedCount === undefined || reachedCount === undefined || reachedCount <= intendedCount)

  return (
    <section className="space-y-3 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Delivery</h3>
        <p className="text-xs text-muted-foreground">
          Confirm whether the intervention reached the intended group. Delivery does not establish
          that the employee signal improved.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`delivery-status-${action.id}`}>Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as ActionDeliveryStatus)}>
          <SelectTrigger id={`delivery-status-${action.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DELIVERY_STATUSES.map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`delivery-date-${action.id}`}>Delivered on</Label>
          <Input
            id={`delivery-date-${action.id}`}
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`delivery-group-${action.id}`}>Affected group</Label>
          <Input
            id={`delivery-group-${action.id}`}
            value={affectedGroup}
            onChange={(event) => setAffectedGroup(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`delivery-intended-${action.id}`}>Intended audience</Label>
          <Input
            id={`delivery-intended-${action.id}`}
            type="number"
            min="0"
            step="1"
            value={intended}
            onChange={(event) => setIntended(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`delivery-reached-${action.id}`}>Reached audience</Label>
          <Input
            id={`delivery-reached-${action.id}`}
            type="number"
            min="0"
            step="1"
            value={reached}
            onChange={(event) => setReached(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`delivery-note-${action.id}`}>Delivery note</Label>
        <Textarea
          id={`delivery-note-${action.id}`}
          rows={2}
          value={deliveryNote}
          onChange={(event) => setDeliveryNote(event.target.value)}
          placeholder="Optional group-level delivery note"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!valid}
        onClick={() => onSave(action.id, {
          status,
          deliveryDate: deliveryDate || undefined,
          affectedGroup: affectedGroup.trim() || undefined,
          intendedAudienceCount: intendedCount,
          reachedAudienceCount: reachedCount,
          deliveryNote: deliveryNote.trim() || undefined,
        })}
      >
        Save delivery
      </Button>
      {!valid ? (
        <p className="text-xs text-muted-foreground">
          Delivered or partially delivered actions need a date and affected group. Reached cannot exceed intended.
        </p>
      ) : null}
    </section>
  )
}

/**
 * Detail and assignment editing for one approved action. Completion means the
 * activity was performed — never that the workforce outcome improved.
 */
export function ActionDetailSheet({
  action, today, onClose, onUpdateAssignment, onUpdateDelivery, privacySuppressed = false,
}: ActionDetailSheetProps) {
  if (!action) return null

  const fields = [
    { key: 'issue', label: 'Linked issue', value: action.issueTitle || EMPTY_VALUE },
    { key: 'scope', label: 'Affected scope', value: action.affectedScope || EMPTY_VALUE },
    { key: 'owner', label: 'Owner', value: action.owner },
    { key: 'start', label: 'Start date', value: formatDate(action.startDate) },
    { key: 'due', label: 'Due date', value: formatDate(action.dueDate) },
    { key: 'window', label: 'Timeline', value: formatDueWindow(action, today) },
    ...(privacySuppressed ? [{ key: 'privacy', label: 'Measurement detail', value: PRIVACY_SUPPRESSED_MESSAGE }] : [{
      key: 'baseline',
      label: `Baseline · ${action.baselineMetric?.label ?? 'measure'}`,
      value: formatActionMetric(action.baselineMetric),
    }, { key: 'target', label: 'Target', value: formatActionMetric(action.targetMetric) }]),
    { key: 'measurement', label: 'Measurement type', value: action.measurementType === 'numeric' ? 'Numeric target' : 'Qualitative / diagnostic' },
    ...(action.noTargetReason ? [{ key: 'targetReason', label: 'No-target reason', value: action.noTargetReason }] : []),
    { key: 'created', label: 'Approved on', value: formatDate((action.approvedAt ?? action.createdAt).slice(0, 10)) },
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
                score={privacySuppressed ? undefined : action.priorityScoreAtCreation}
              />
            ) : null}
            {action.editedByHr ? <Badge variant="outline">Edited by HR</Badge> : null}
            {action.delivery ? (
              <Badge variant="outline">Delivery: {ACTION_DELIVERY_STATUS_LABELS[action.delivery.status]}</Badge>
            ) : null}
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

          {action.status === 'planned' || action.status === 'in-progress' ? (
            <AssignmentEditor
              key={action.id}
              action={action}
              onSave={onUpdateAssignment}
            />
          ) : null}

          <DeliveryEditor
            key={`${action.id}-${action.updatedAt}`}
            action={action}
            onSave={onUpdateDelivery}
          />

          {action.evidenceSources?.length && !privacySuppressed ? (
            <div className="flex flex-wrap gap-1.5">
              {action.evidenceSources.map((source) => (
                <Badge key={source} variant="outline">{source}</Badge>
              ))}
            </div>
          ) : null}

          <section className="space-y-1">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Success measure
            </h3>
            <p className="text-sm break-words">{action.successMeasure}</p>
            <p className="text-xs text-muted-foreground">
              Marking an action completed records that it was performed. Whether it worked is
              assessed separately when comparable evidence becomes available.
            </p>
          </section>

          <section className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">Outcome</h3>
            <p className="text-sm text-muted-foreground">
              Delivery confirms implementation only. Outcome success is assessed separately from
              comparable follow-up evidence.
            </p>
            <p className="text-sm font-medium">
              Outcome status:{' '}
              {!action.impactMetricKey
                ? 'Not configured'
                : action.status === 'completed'
                  ? 'Awaiting comparable follow-up'
                  : 'Awaiting action completion'}
            </p>
            {action.impactMetricKey ? (
              <Link
                to={`/impact?action=${action.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
              >
                View outcome measurement
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">Outcome measurement is not configured for this action.</p>
            )}
          </section>

          {action.history.length > 0 ? (
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">Action history</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {[...action.history].reverse().map((event, index) => (
                  <li key={`${event.timestamp}-${event.type}-${index}`}>
                    <span className="font-medium text-foreground">{event.description}</span>
                    <span> · {formatDate(event.timestamp.slice(0, 10))}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

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
            {action.issueId && !action.insightId ? (
              <Link
                to="/insights"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
              >
                View priority analysis
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
