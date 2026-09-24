import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ActionExecutionStatus, HrAction, RecommendedAction } from '@/types/hr-actions'
import { todayIsoDate } from '@/utils/date'
import { formatCount } from '@/utils/format'
import { isActionOverdue } from '@/utils/hr-action-view'

type ActionSummaryProps = {
  recommendations: RecommendedAction[]
  activeActions: HrAction[]
}

type SummaryItem = {
  key: string
  label: string
  value: number
}

/**
 * Two pipelines, deliberately kept apart: what HR still has to decide, and how
 * approved demo actions are progressing. Merging them would let a rejected
 * recommendation read as a tracked action. Official workbook actions are counted
 * in neither — they live in their own read-only tab.
 */
export function ActionSummary({ recommendations, activeActions }: ActionSummaryProps) {
  const today = todayIsoDate()

  const countReviews = (status: RecommendedAction['reviewStatus']): number =>
    recommendations.filter((entry) => entry.reviewStatus === status).length

  const countActions = (status: ActionExecutionStatus): number =>
    activeActions.filter((action) => action.status === status).length

  const reviewItems: SummaryItem[] = [
    { key: 'pending', label: 'Pending review', value: countReviews('pending-review') },
    { key: 'approved', label: 'Approved', value: countReviews('approved') },
    { key: 'rejected', label: 'Rejected', value: countReviews('rejected') },
  ]

  const progressItems: SummaryItem[] = [
    { key: 'planned', label: 'Approved', value: countActions('planned') },
    { key: 'in-progress', label: 'In progress', value: countActions('in-progress') },
    { key: 'completed', label: 'Completed', value: countActions('completed') },
    {
      key: 'overdue',
      label: 'Overdue',
      value: activeActions.filter((action) => isActionOverdue(action, today)).length,
    },
  ]

  const sections = [
    {
      key: 'recommendations',
      title: 'Recommendation pipeline',
      description: 'System suggestions awaiting or completed HR review.',
      items: reviewItems,
    },
    {
      key: 'actions',
      title: 'Demo action progress',
      description: 'Approved actions tracked in this browser.',
      items: progressItems,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {sections.map((section) => (
        <Card key={section.key} size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {section.items.map((item) => (
                <div key={item.key} className="min-w-0 space-y-0.5">
                  <dt className="text-xs break-words text-muted-foreground">{item.label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{formatCount(item.value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
