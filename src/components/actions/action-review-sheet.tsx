import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { OWNER_ROLE_OPTIONS, REJECTION_REASONS } from '@/data/hr-action-catalog'
import { TARGET_DISCLAIMER } from '@/data/hr-action-targets'
import type { ActionMeasurementType, ActionReviewDraft, RecommendedAction } from '@/types/hr-actions'
import { isBefore, isValidIsoDate, todayIsoDate } from '@/utils/date'
import { formatActionMetric } from '@/utils/hr-action-view'

type ActionReviewSheetProps = {
  recommendation: RecommendedAction | null
  onClose: () => void
  onApprove: (recommendation: RecommendedAction, draft: ActionReviewDraft) => void
  onReject: (recommendationId: string, reason?: string) => void
}

const NO_REASON = 'none'

type DraftErrors = Partial<Record<keyof ActionReviewDraft | 'baseline', string>>

function buildDraft(recommendation: RecommendedAction): ActionReviewDraft {
  const startDate = todayIsoDate()
  return {
    title: recommendation.title,
    description: recommendation.description,
    owner: recommendation.suggestedOwner,
    startDate,
    dueDate: '',
    successMeasure: recommendation.successMeasure,
    targetValue:
      recommendation.suggestedTarget.value === null
        ? ''
        : String(recommendation.suggestedTarget.value),
    measurementType: recommendation.impactMetricKey ? 'numeric' : 'qualitative',
    noTargetReason: '',
  }
}

function validate(draft: ActionReviewDraft, recommendation: RecommendedAction): DraftErrors {
  const errors: DraftErrors = {}

  if (draft.title.trim() === '') errors.title = 'An action needs a title.'
  if (draft.owner.trim() === '') errors.owner = 'An approved action needs a named owner role.'
  if (draft.successMeasure.trim() === '') {
    errors.successMeasure = 'An approved action needs a measurable success definition.'
  }
  if (recommendation.baselineMetric.value === null || recommendation.baselineMetric.label.trim() === '') {
    errors.baseline = 'An approved action needs a recorded baseline.'
  }
  if (!isValidIsoDate(draft.startDate)) errors.startDate = 'Enter a valid start date.'
  if (!isValidIsoDate(draft.dueDate)) errors.dueDate = 'Enter a valid due date.'
  else if (isBefore(draft.dueDate, draft.startDate)) {
    errors.dueDate = 'The due date cannot fall before the start date.'
  }

  if (draft.measurementType === 'numeric') {
    if (draft.targetValue.trim() === '') errors.targetValue = 'A numeric action needs a target.'
    else if (!Number.isFinite(Number(draft.targetValue))) errors.targetValue = 'Enter a valid numeric target.'
  } else if (draft.noTargetReason.trim() === '') {
    errors.noTargetReason = 'Explain why a numeric target is not appropriate.'
  }

  return errors
}

/**
 * The human-in-the-loop step. The system has suggested an intervention; here a
 * person changes whatever they disagree with and decides. Approval creates a
 * tracked record and nothing else — no message is sent, no policy changes, and
 * the underlying insight stays exactly as the analytics layer measured it.
 */
export function ActionReviewSheet({
  recommendation,
  onClose,
  onApprove,
  onReject,
}: ActionReviewSheetProps) {
  if (!recommendation) return null

  return (
    <Sheet open onOpenChange={(next) => (next ? undefined : onClose())}>
      {/* Keyed on the recommendation so a different one starts from a fresh
          draft, rather than an effect resetting the fields after render. */}
      <ReviewForm
        key={recommendation.id}
        recommendation={recommendation}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />
    </Sheet>
  )
}

type ReviewFormProps = Omit<ActionReviewSheetProps, 'recommendation'> & {
  recommendation: RecommendedAction
}

function ReviewForm({ recommendation, onClose, onApprove, onReject }: ReviewFormProps) {
  const [draft, setDraft] = useState<ActionReviewDraft>(() => buildDraft(recommendation))
  const [rejectionReason, setRejectionReason] = useState<string>(NO_REASON)
  const [showErrors, setShowErrors] = useState(false)

  const errors = useMemo(() => validate(draft, recommendation), [draft, recommendation])

  const ownerOptions = useMemo(
    () => [
      recommendation.suggestedOwner,
      ...OWNER_ROLE_OPTIONS.filter((role) => role !== recommendation.suggestedOwner),
    ],
    [recommendation.suggestedOwner],
  )

  const update = <Field extends keyof ActionReviewDraft>(
    field: Field,
    value: ActionReviewDraft[Field],
  ): void => setDraft((current) => ({ ...current, [field]: value }))

  const errorFor = (field: keyof ActionReviewDraft | 'baseline'): string | undefined =>
    showErrors ? errors[field] : undefined

  const handleApprove = (): void => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true)
      return
    }
    onApprove(recommendation, draft)
    onClose()
  }

  const handleReject = (): void => {
    onReject(recommendation.id, rejectionReason === NO_REASON ? undefined : rejectionReason)
    onClose()
  }

  const fieldError = (field: keyof ActionReviewDraft | 'baseline') => {
    const message = errorFor(field)
    return message ? (
      <p id={`${field}-error`} role="alert" className="text-xs text-destructive">
        {message}
      </p>
    ) : null
  }

  return (
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        aria-describedby="review-description"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Review recommended action</SheetTitle>
          <SheetDescription id="review-description">
            The system suggested this intervention. Change anything you disagree with, then approve
            or reject it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <section className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{recommendation.driverLabel}</Badge>
              <Badge variant="ghost" className="text-muted-foreground">
                Priority {recommendation.priorityScore} / 100
              </Badge>
            </div>
            <p className="text-sm font-medium break-words">{recommendation.issueTitle}</p>
            <p className="text-xs break-words text-muted-foreground">
              {recommendation.affectedScope}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recommendation.evidenceSources.map((source) => (
                <Badge key={source} variant="ghost" className="text-muted-foreground">{source}</Badge>
              ))}
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Why this action? </span>
              {recommendation.rationale}
            </p>
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="action-title">Action title</Label>
            <Input
              id="action-title"
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              aria-invalid={errorFor('title') !== undefined}
              aria-describedby={errorFor('title') ? 'title-error' : undefined}
            />
            {fieldError('title')}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action-description">Description</Label>
            <Textarea
              id="action-description"
              rows={4}
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action-owner">Owner</Label>
            <Select value={draft.owner} onValueChange={(value) => update('owner', value)}>
              <SelectTrigger id="action-owner" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ownerOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A role suggestion for this prototype, not a named employee.
            </p>
            {fieldError('owner')}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="action-start">Start date</Label>
              <Input
                id="action-start"
                type="date"
                value={draft.startDate}
                onChange={(event) => update('startDate', event.target.value)}
                aria-invalid={errorFor('startDate') !== undefined}
              />
              {fieldError('startDate')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="action-due">Due date</Label>
              <Input
                id="action-due"
                type="date"
                value={draft.dueDate}
                onChange={(event) => update('dueDate', event.target.value)}
                aria-invalid={errorFor('dueDate') !== undefined}
                aria-describedby={errorFor('dueDate') ? 'dueDate-error' : undefined}
              />
              {fieldError('dueDate')}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action-measure">Success measure</Label>
            <Textarea
              id="action-measure"
              rows={3}
              value={draft.successMeasure}
              onChange={(event) => update('successMeasure', event.target.value)}
              aria-invalid={errorFor('successMeasure') !== undefined}
              aria-describedby={errorFor('successMeasure') ? 'successMeasure-error' : undefined}
            />
            {fieldError('successMeasure')}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Measurement type</p>
              <p className="text-xs text-muted-foreground">
                Choose numeric when HR will judge movement against a target. Choose qualitative
                only when a numeric target is genuinely not appropriate.
              </p>
            </div>
            <Select
              value={draft.measurementType}
              onValueChange={(value) => {
                const measurementType = value as ActionMeasurementType
                update('measurementType', measurementType)
                if (measurementType === 'qualitative') update('targetValue', '')
              }}
            >
              <SelectTrigger aria-label="Measurement type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numeric target</SelectItem>
                <SelectItem value="qualitative">Qualitative / diagnostic</SelectItem>
              </SelectContent>
            </Select>
            {draft.measurementType === 'qualitative' ? (
              <div className="space-y-1.5">
                <Label htmlFor="action-no-target-reason">Why no numeric target is appropriate</Label>
                <Textarea
                  id="action-no-target-reason"
                  rows={3}
                  value={draft.noTargetReason}
                  onChange={(event) => update('noTargetReason', event.target.value)}
                  aria-invalid={errorFor('noTargetReason') !== undefined}
                />
                {fieldError('noTargetReason')}
              </div>
            ) : null}
            {fieldError('baseline') ? (
              <p role="alert" className="text-xs text-destructive">{fieldError('baseline')}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action-target">
              Target · {recommendation.suggestedTarget.label || 'measure'}
            </Label>
            <Input
              id="action-target"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={draft.targetValue}
              disabled={draft.measurementType !== 'numeric'}
              onChange={(event) => update('targetValue', event.target.value)}
              aria-invalid={errorFor('targetValue') !== undefined}
            />
            <p className="text-xs text-muted-foreground">
              Baseline {formatActionMetric(recommendation.baselineMetric)} · suggested target{' '}
              {formatActionMetric(recommendation.suggestedTarget)}. {TARGET_DISCLAIMER}
            </p>
            {fieldError('targetValue')}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rejection-reason">Reason for rejection (optional)</Label>
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger id="rejection-reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REASON}>No reason given</SelectItem>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="outline" size="sm" onClick={handleReject}>
            Reject
          </Button>
          <Button size="sm" onClick={handleApprove}>
            Approve action
          </Button>
        </SheetFooter>
      </SheetContent>
  )
}
