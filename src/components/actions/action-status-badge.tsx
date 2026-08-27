import { Badge } from '@/components/ui/badge'
import {
  ACTION_STATUS_LABELS,
  RECOMMENDATION_STATUS_LABELS,
} from '@/data/hr-action-catalog'
import type { ActionExecutionStatus, RecommendedActionStatus } from '@/types/hr-actions'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'ghost'

/**
 * Monochrome by weight, not colour — the word carries the meaning, so the
 * status stays readable in greyscale and for anyone who cannot rely on hue.
 */
const EXECUTION_VARIANTS: Record<ActionExecutionStatus, BadgeVariant> = {
  completed: 'default',
  'in-progress': 'secondary',
  planned: 'outline',
  cancelled: 'ghost',
}

const REVIEW_VARIANTS: Record<RecommendedActionStatus, BadgeVariant> = {
  'pending-review': 'secondary',
  approved: 'default',
  rejected: 'ghost',
}

export function ActionStatusBadge({
  status,
  isOverdue = false,
}: {
  status: ActionExecutionStatus
  isOverdue?: boolean
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Badge variant={EXECUTION_VARIANTS[status]}>{ACTION_STATUS_LABELS[status]}</Badge>
      {/* Overdue is derived from the due date, never stored as a fifth status. */}
      {isOverdue ? <Badge variant="destructive">Overdue</Badge> : null}
    </span>
  )
}

export function ReviewStatusBadge({ status }: { status: RecommendedActionStatus }) {
  return <Badge variant={REVIEW_VARIANTS[status]}>{RECOMMENDATION_STATUS_LABELS[status]}</Badge>
}
