import { AutomationCard } from '@/components/automations/automation-card'
import { AutomationEmptyState } from '@/components/automations/automation-empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { AUTOMATION_TYPE_LABELS, HR_AUTOMATION_RULES } from '@/data/hr-automation-rules'
import type { AutomationTypeCap, HrAutomationItem } from '@/types/hr-automation'

type HrCareInboxProps = {
  items: HrAutomationItem[]
  caps: AutomationTypeCap[]
  /** True when a filter is narrowing the list, so the empty copy can say so. */
  filtered: boolean
  onReviewMessage: (item: HrAutomationItem) => void
  onToggleHandled: (automationId: string, handled: boolean) => void
}

/**
 * The attention inbox: already ranked by the automation service, rendered as one
 * readable column. Cards carry a message draft, a linked action and a reason, so
 * they are given room rather than squeezed into a narrow grid.
 */
export function HrCareInbox({
  items,
  caps,
  filtered,
  onReviewMessage,
  onToggleHandled,
}: HrCareInboxProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <AutomationEmptyState filtered={filtered} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <AutomationCard
          key={item.id}
          item={item}
          onReviewMessage={onReviewMessage}
          onToggleHandled={onToggleHandled}
        />
      ))}

      {/* A cap that hides work silently would read as "nothing else to do". */}
      {caps.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Showing at most {HR_AUTOMATION_RULES.maxItemsPerType} reminders per type:{' '}
          {caps
            .map(
              (cap) =>
                `${AUTOMATION_TYPE_LABELS[cap.type].toLowerCase()} ${cap.shown} of ${cap.detected}`,
            )
            .join(', ')}
          .
        </p>
      ) : null}
    </div>
  )
}
