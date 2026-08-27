import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AutomationSummary as AutomationSummaryCounts } from '@/types/hr-automation'
import { formatCount } from '@/utils/format'

type AutomationSummaryProps = {
  summary: AutomationSummaryCounts
}

/**
 * Compact counts, every one of them derived from the live reminder list rather
 * than stored. `Needs attention` is the total still awaiting a person; the other
 * three break that total down by when it is due.
 */
export function AutomationSummary({ summary }: AutomationSummaryProps) {
  const automationSummary = [
    {
      key: 'needsAttention',
      label: 'Needs attention',
      value: summary.needsAttention,
      description: 'Reminders awaiting HR',
    },
    { key: 'dueToday', label: 'Due today', value: summary.dueToday, description: 'Happening today' },
    { key: 'upcoming', label: 'Upcoming', value: summary.upcoming, description: 'Still ahead' },
    { key: 'overdue', label: 'Overdue', value: summary.overdue, description: 'Past their date' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {automationSummary.map((item) => (
        <Card key={item.key} size="sm" className="min-w-0 gap-2">
          <CardHeader>
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="text-2xl font-semibold tabular-nums">{formatCount(item.value)}</p>
            <p className="text-xs break-words text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
