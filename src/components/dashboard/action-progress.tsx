import { ArrowRight, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ACTION_RECORD_LIMIT } from '@/data/dashboard.constants'
import type { ActionAnalytics } from '@/types/hr-analytics'
import { formatCount, formatPercentage } from '@/utils/format'

type ActionProgressProps = {
  actions: ActionAnalytics
  /** Demo recommendations awaiting review, kept separate from the official counts. */
  pendingRecommendations: number
}

/** Monochrome only — status is read from the word, not from a colour. */
const STATUS_VARIANTS = new Map<string, 'default' | 'secondary' | 'outline'>([
  ['Completed', 'default'],
  ['In Progress', 'secondary'],
  ['Planned', 'outline'],
])

const SUMMARY_FIELDS = [
  { key: 'totalActions', label: 'Total' },
  { key: 'completedActions', label: 'Completed' },
  { key: 'inProgressActions', label: 'In Progress' },
  { key: 'plannedActions', label: 'Planned' },
] as const satisfies readonly { key: keyof ActionAnalytics; label: string }[]

export function ActionProgress({ actions, pendingRecommendations }: ActionProgressProps) {
  const records = actions.records.slice(0, ACTION_RECORD_LIMIT)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>HR Actions</CardTitle>
        <CardDescription>
          Progress of actions already recorded in the official dataset.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {actions.totalActions === 0 ? (
          <EmptyState icon={ClipboardList} title="No actions recorded in the dataset." />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {SUMMARY_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatCount(actions[key] as number)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Completion rate</span>
                <span className="text-sm font-medium tabular-nums">
                  {formatPercentage(actions.completionRate)}
                </span>
              </div>
              <Progress value={actions.completionRate ?? 0} aria-label="Action completion rate" />
            </div>

            <ul className="space-y-3 border-t pt-4">
              {records.map((record) => (
                <li key={record.actionId} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium break-words">{record.action}</p>
                    <p className="text-xs break-words text-muted-foreground">
                      {record.owner} · {record.scope}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANTS.get(record.status) ?? 'outline'} className="shrink-0">
                    {record.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Kept below the official figures, and counted separately, so the
            workbook's numbers stay exactly what the workbook says. */}
        {pendingRecommendations > 0 ? (
          <Link
            to="/actions"
            className="inline-flex items-center gap-1 border-t pt-4 text-sm font-medium transition-colors hover:text-muted-foreground"
          >
            {formatCount(pendingRecommendations)}{' '}
            {pendingRecommendations === 1 ? 'recommendation' : 'recommendations'} awaiting review
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
