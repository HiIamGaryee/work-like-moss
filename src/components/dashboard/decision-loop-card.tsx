import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DecisionLoop } from '@/components/impact/decision-loop'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ImpactSummary } from '@/types/hr-impact'
import type { DecisionLoopStage } from '@/utils/decision-loop'
import { formatCount } from '@/utils/format'

type DecisionLoopCardProps = {
  summary: ImpactSummary
  /** True once at least one insight has been detected from the workbook. */
  hasInsights: boolean
  /** True once HR has approved at least one action. */
  hasApprovedActions: boolean
}

/**
 * How far the organisation's own decision loop has travelled, in one line.
 *
 * Shown on the dashboard only once demo actions exist, so a fresh demo keeps the
 * Overview clean rather than displaying a loop with nothing in it.
 */
export function DecisionLoopCard({
  summary,
  hasInsights,
  hasApprovedActions,
}: DecisionLoopCardProps) {
  const measured = summary.measurementsAvailable > 0
  const awaiting = summary.awaitingMeasurement > 0

  const stages: DecisionLoopStage[] = [
    { label: 'Detect', status: hasInsights ? 'complete' : 'pending' },
    { label: 'Explain', status: hasInsights ? 'complete' : 'pending' },
    { label: 'Prioritise', status: hasInsights ? 'complete' : 'pending' },
    { label: 'Act', status: hasApprovedActions ? 'complete' : 'pending' },
    measured
      ? { label: 'Measure', status: 'complete' }
      : awaiting
        ? { label: 'Measure', status: 'current', detail: 'Awaiting' }
        : { label: 'Measure', status: 'pending' },
  ]

  const counts = [
    { key: 'tracked', label: 'tracked', value: summary.actionsTracked },
    { key: 'measured', label: 'measured', value: summary.measurementsAvailable },
    { key: 'awaiting', label: 'awaiting measurement', value: summary.awaitingMeasurement },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Action measurement</CardTitle>
        <CardDescription>
          Every action keeps its baseline and target, so the loop can be closed rather than assumed.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <DecisionLoop stages={stages} />

        <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t pt-4">
          {counts.map((count) => (
            <div key={count.key} className="flex items-baseline gap-1.5">
              <dt className="sr-only">{count.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{formatCount(count.value)}</dd>
              <dd className="text-xs text-muted-foreground">{count.label}</dd>
            </div>
          ))}
        </dl>

        <Link
          to="/impact"
          className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
        >
          View impact tracker
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}
