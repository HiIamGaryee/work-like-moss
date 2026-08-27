import {
  Award,
  Cake,
  Clock,
  HandCoins,
  MessagesSquare,
  Star,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AutomationHandledBadge,
  AutomationSourceBadges,
  AutomationUrgencyBadge,
} from '@/components/automations/automation-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AUTOMATION_TYPE_LABELS, CARE_CHANNEL_LABELS } from '@/data/hr-automation-rules'
import type { AutomationType, HrAutomationItem } from '@/types/hr-automation'
import { formatRelativeDay } from '@/utils/date'
import { formatDate } from '@/utils/format'

type AutomationCardProps = {
  item: HrAutomationItem
  onReviewMessage: (item: HrAutomationItem) => void
  onToggleHandled: (automationId: string, handled: boolean) => void
}

/** Icon plus label carries the type; colour never does. */
const TYPE_ICONS: Record<AutomationType, LucideIcon> = {
  birthday: Cake,
  'work-anniversary': Award,
  'onboarding-checkin': UserPlus,
  'manager-checkin': MessagesSquare,
  'compensation-review': HandCoins,
  recognition: Star,
  'action-due': Clock,
  'action-overdue': TriangleAlert,
}

/**
 * One thing that is easy to forget, and what a person could do about it today.
 *
 * The card never claims anything was sent. Its primary button opens a draft for
 * review; marking the reminder handled is a separate, deliberate choice, because
 * opening a composer is not proof that a message went out.
 */
export function AutomationCard({ item, onReviewMessage, onToggleHandled }: AutomationCardProps) {
  const TypeIcon = TYPE_ICONS[item.type]
  const hasMessage = item.messageTemplate !== undefined

  const facts = [
    item.employeeName || item.employeeId
      ? {
          key: 'employee',
          label: 'Employee',
          value: item.employeeName ?? item.employeeId ?? '',
        }
      : null,
    item.employeeContext
      ? { key: 'context', label: 'Division · group', value: item.employeeContext }
      : null,
    item.actionOwner ? { key: 'owner', label: 'Owner', value: item.actionOwner } : null,
    item.eventDate
      ? {
          key: 'date',
          label: 'Date',
          value:
            item.daysUntilEvent === undefined
              ? formatDate(item.eventDate)
              : `${formatDate(item.eventDate)} · ${formatRelativeDay(item.daysUntilEvent)}`,
        }
      : null,
    item.preferredChannel
      ? {
          key: 'channel',
          label: 'Preferred channel',
          value: CARE_CHANNEL_LABELS[item.preferredChannel],
        }
      : null,
  ].filter((fact): fact is { key: string; label: string; value: string } => fact !== null)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <TypeIcon className="size-3.5" aria-hidden="true" />
            {AUTOMATION_TYPE_LABELS[item.type]}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {item.handled ? <AutomationHandledBadge /> : <AutomationUrgencyBadge urgency={item.urgency} />}
          </span>
        </div>
        <CardTitle className="text-base leading-snug break-words">{item.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">{item.description}</p>

        {facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.key} className="min-w-0 space-y-0.5">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="text-sm font-medium break-words">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="space-y-3 border-t pt-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">Suggested next step</p>
            <p className="text-sm break-words">{item.suggestedAction}</p>
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">Why it appeared</p>
            <p className="text-xs break-words text-muted-foreground">{item.reason}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-2 border-t pt-3">
          <AutomationSourceBadges sources={item.sources} />

          <span className="ml-auto flex flex-wrap items-center gap-2">
            {item.linkTo ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={item.linkTo}>{item.linkLabel ?? 'Open'}</Link>
              </Button>
            ) : null}

            {hasMessage ? (
              <Button size="sm" onClick={() => onReviewMessage(item)}>
                Review message
              </Button>
            ) : null}

            <Button
              variant={hasMessage ? 'outline' : 'default'}
              size="sm"
              onClick={() => onToggleHandled(item.id, !item.handled)}
            >
              {item.handled ? 'Reopen' : 'Mark as handled'}
            </Button>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
