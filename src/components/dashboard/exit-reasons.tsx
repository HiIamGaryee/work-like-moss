import { DoorOpen } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExitReasonMetric } from '@/types/hr-analytics'
import { formatCount, formatPercentage } from '@/utils/format'

type ExitReasonsProps = {
  reasons: ExitReasonMetric[]
  responseCount: number
}

/**
 * A ranked list with one monochrome bar style. Bar width is the real share of
 * responses; source reason wording is shown exactly as the workbook records it.
 */
export function ExitReasons({ reasons, responseCount }: ExitReasonsProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Why Employees Leave</CardTitle>
        <CardDescription>
          Most common primary exit reasons in the provided dataset.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        {reasons.length === 0 ? (
          <EmptyState icon={DoorOpen} title="No exit survey responses available." />
        ) : (
          <ol className="space-y-3.5">
            {reasons.map((reason, index) => (
              <li key={reason.reason} className="space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {reason.reason}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">{reason.count}</span>
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {formatPercentage(reason.percentage)}
                  </span>
                </div>
                <div className="ml-7 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${reason.percentage ?? 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-auto border-t pt-4 text-xs text-muted-foreground">
          Based on {formatCount(responseCount)} exit survey responses.
        </p>
      </CardContent>
    </Card>
  )
}
