import { InfoHint } from '@/components/dashboard/info-hint'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { PriorityBreakdown } from '@/components/insights/priority-breakdown'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PRIORITY_FORMULA_NOTE } from '@/data/hr-priority-rules'
import type { InsightPriority } from '@/types/hr-intelligence'

type PriorityScoreCardProps = {
  priority: InsightPriority
}

export function PriorityScoreCard({ priority }: PriorityScoreCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Priority Assessment
          <InfoHint label="how priority is calculated" hint={PRIORITY_FORMULA_NOTE} />
        </CardTitle>
        <CardDescription>Requires management review — not an instruction.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {priority.score}
            <span className="text-base font-normal text-muted-foreground"> / 100</span>
          </p>
          <PriorityBadge level={priority.level} />
        </div>

        <p className="text-sm text-muted-foreground">{priority.explanation}</p>

        <div className="border-t pt-4">
          <PriorityBreakdown components={priority.components} />
        </div>
      </CardContent>
    </Card>
  )
}
