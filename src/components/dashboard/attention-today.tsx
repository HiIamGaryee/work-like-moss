import { ArrowRight, BellOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AutomationUrgencyBadge } from '@/components/automations/automation-status-badge'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AUTOMATION_TYPE_LABELS } from '@/data/hr-automation-rules'
import type { HrAutomationItem } from '@/types/hr-automation'
import { formatCount } from '@/utils/format'

type AttentionTodayProps = {
  items: HrAutomationItem[]
  totalActive: number
}

/** Enough to prove the inbox is working, not enough to duplicate it. */
const PREVIEW_LIMIT = 3

/**
 * A three-line window onto the Automations page. The dashboard shows that
 * something needs a person today; the full list, the drafts and the composers
 * all stay where they belong.
 */
export function AttentionToday({ items, totalActive }: AttentionTodayProps) {
  const preview = items.slice(0, PREVIEW_LIMIT)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Today needs attention</CardTitle>
        <CardDescription>
          {totalActive === 0
            ? 'Employee-care and action reminders will appear here.'
            : `${formatCount(totalActive)} employee-care and action ${totalActive === 1 ? 'reminder' : 'reminders'} awaiting review.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {preview.length === 0 ? (
          <EmptyState icon={BellOff} title="Nothing needs attention right now." />
        ) : (
          <ul className="space-y-3">
            {preview.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium break-words">{item.title}</p>
                  <p className="text-xs break-words text-muted-foreground">
                    {AUTOMATION_TYPE_LABELS[item.type]}
                    {item.employeeName ? ` · ${item.employeeName}` : ''}
                  </p>
                </div>
                <AutomationUrgencyBadge urgency={item.urgency} />
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/automations"
          className="inline-flex items-center gap-1 border-t pt-4 text-sm font-medium transition-colors hover:text-muted-foreground"
        >
          View all automations
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}
