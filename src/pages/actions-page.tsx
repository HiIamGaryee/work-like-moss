import { ListChecks, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ActionDetailSheet } from '@/components/actions/action-detail-sheet'
import { ActionReviewSheet } from '@/components/actions/action-review-sheet'
import { ActionSummary } from '@/components/actions/action-summary'
import { ActiveActionCard } from '@/components/actions/active-action-card'
import { ExistingActionsTable } from '@/components/actions/existing-actions-table'
import { RecommendationCard } from '@/components/actions/recommendation-card'
import { InfoHint } from '@/components/dashboard/info-hint'
import { DatasetError } from '@/components/dataset-status'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { ResetDemoMenu } from '@/components/reset-demo-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ACTION_RULES_NOTE, LOCAL_STORAGE_NOTE } from '@/data/hr-action-targets'
import { PRIORITY_LEVEL_LABELS } from '@/data/hr-priority-rules'
import { useHrActions } from '@/hooks/use-hr-actions'
import type {
  ActionAssignmentDraft,
  ActionDeliveryDraft,
  ActionExecutionStatus,
  HrAction,
  RecommendedAction,
} from '@/types/hr-actions'
import { todayIsoDate } from '@/utils/date'
import { formatCount } from '@/utils/format'
import { isActionOverdue } from '@/utils/hr-action-view'
import { isGroupScopeSuppressed } from '@/utils/insight-privacy'

/* ------------------------------------------------------------------ filters */

const ACTION_TABS = [
  {
    key: 'recommendations',
    label: 'Suggested Actions',
    description: 'System-generated interventions awaiting HR review.',
  },
  {
    key: 'active',
    label: 'Active Actions',
    description: 'Approved demo actions currently being tracked.',
  },
  {
    key: 'completed',
    label: 'Completed Actions',
    description: 'Completed activity is recorded here; outcome improvement is not implied.',
  },
  {
    key: 'existing',
    label: 'Existing Actions',
    description: 'Actions provided in the official dataset.',
  },
] as const

type ActionTabKey = (typeof ACTION_TABS)[number]['key']

const REVIEW_FILTERS = [
  { key: 'pending-review', label: 'Suggested' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All recommendations' },
] as const

type ReviewFilterKey = (typeof REVIEW_FILTERS)[number]['key']

const PRIORITY_FILTERS = [
  { key: 'all', label: 'All priorities' },
  { key: 'critical', label: PRIORITY_LEVEL_LABELS.critical },
  { key: 'high', label: PRIORITY_LEVEL_LABELS.high },
  { key: 'medium', label: PRIORITY_LEVEL_LABELS.medium },
] as const

type PriorityFilterKey = (typeof PRIORITY_FILTERS)[number]['key']

const STATUS_FILTERS = [
  { key: 'all', label: 'All statuses' },
  { key: 'planned', label: 'Approved' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'overdue', label: 'Overdue' },
] as const

type StatusFilterKey = (typeof STATUS_FILTERS)[number]['key']

function ActionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * The HR Action Centre.
 *
 * The product line this page completes: the system detects an issue, explains
 * the evidence and suggests one intervention — then a person reviews it, edits
 * whatever they disagree with, and decides. Approval creates an accountable
 * record with an owner, a deadline and a measurable outcome. It sends nothing,
 * changes no policy, and never acts on its own.
 *
 * Composition only: every card, table and form lives in `components/actions`.
 */
export function ActionsPage() {
  const {
    analytics,
    recommendations,
    activeActions,
    officialActions,
    storageAvailable,
    isLoading,
    error,
    retry,
    approveAction,
    rejectRecommendation,
    updateAction,
    updateActionAssignment,
    updateActionDelivery,
    resetDemo,
  } = useHrActions()

  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<ActionTabKey>('recommendations')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilterKey>('pending-review')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterKey>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all')
  const [reviewing, setReviewing] = useState<RecommendedAction | null>(null)
  const [detailAction, setDetailAction] = useState<HrAction | null>(null)

  const today = todayIsoDate()
  const focusId = searchParams.get('recommendation')
  const focusIssueId = searchParams.get('issue')
  const focusActionId = searchParams.get('action')

  /**
   * `/actions?recommendation=<id>` arrives from an insight's "Recommended Next
   * Step". Where it lands depends on what HR already decided, so the deep link
   * never opens a review panel for something already approved.
   */
  useEffect(() => {
    if ((!focusId && !focusIssueId && !focusActionId) || isLoading) return

    if (focusActionId) {
      const action = activeActions.find((entry) => entry.id === focusActionId)
      if (action) {
        setTab(action.status === 'completed' || action.status === 'cancelled' ? 'completed' : 'active')
        setDetailAction(action)
      }
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.delete('action')
          return next
        },
        { replace: true },
      )
      return
    }

    const recommendation = recommendations.find((entry) =>
      focusIssueId ? entry.issueId === focusIssueId : entry.id === focusId,
    )
    if (recommendation) {
      const linkedAction = activeActions.find(
        (action) => action.sourceRecommendationId === recommendation.id,
      )

      if (recommendation.reviewStatus === 'approved' && linkedAction) {
        setTab(linkedAction.status === 'completed' || linkedAction.status === 'cancelled'
          ? 'completed'
          : 'active')
        setDetailAction(linkedAction)
      } else if (recommendation.reviewStatus === 'rejected') {
        setTab('recommendations')
        setReviewFilter('rejected')
      } else if (isGroupScopeSuppressed(recommendation.impactScope, recommendation.evidenceSources, analytics)) {
        setTab('recommendations')
      } else {
        setTab('recommendations')
        setReviewing(recommendation)
      }
    }

    /* Consumed once, so a later tab change is not overridden by a stale link. */
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('recommendation')
        next.delete('issue')
        next.delete('action')
        return next
      },
      { replace: true },
    )
  }, [focusId, focusIssueId, focusActionId, isLoading, recommendations, activeActions, analytics, setSearchParams])

  const shownRecommendations = useMemo(
    () =>
      recommendations
        .filter((entry) =>
          reviewFilter === 'all' ? true : entry.reviewStatus === reviewFilter,
        )
        .filter((entry) => (priorityFilter === 'all' ? true : entry.priorityLevel === priorityFilter))
        .sort(
          (a, b) =>
            b.priorityScore - a.priorityScore ||
            a.id.localeCompare(b.id),
        ),
    [recommendations, reviewFilter, priorityFilter],
  )

  const shownActions = useMemo(
    () =>
      activeActions
        .filter((action) => action.status === 'planned' || action.status === 'in-progress')
        .filter((action) => {
          if (statusFilter === 'all') return true
          if (statusFilter === 'overdue') return isActionOverdue(action, today)
          return action.status === statusFilter
        })
        .sort((a, b) =>
          Number(isActionOverdue(b, today)) - Number(isActionOverdue(a, today)) ||
          a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
        ),
    [activeActions, statusFilter, today],
  )

  const completedActions = useMemo(
    () => activeActions
      .filter((action) => action.status === 'completed')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') ||
        a.id.localeCompare(b.id)),
    [activeActions],
  )
  const cancelledActions = useMemo(
    () => activeActions
      .filter((action) => action.status === 'cancelled')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)),
    [activeActions],
  )

  const pendingCount = recommendations.filter(
    (entry) => entry.reviewStatus === 'pending-review',
  ).length

  const handleStatusChange = (actionId: string, status: ActionExecutionStatus): void => {
    const now = new Date().toISOString()
    updateAction(actionId, status)
    setDetailAction((current) =>
      current && current.id === actionId
        ? {
            ...current,
            status,
            updatedAt: now,
            history: [
              ...current.history,
              {
                timestamp: now,
                type: status === 'in-progress' ? 'started' : status === 'completed' ? 'completed' : 'edited',
                description: status === 'in-progress'
                  ? 'Action marked in progress.'
                  : status === 'completed'
                    ? 'Action marked completed. Outcome remains separate.'
                    : 'Action cancelled.',
              },
            ],
          }
        : current,
    )
  }

  const handleAssignmentChange = (actionId: string, draft: ActionAssignmentDraft): void => {
    const now = new Date().toISOString()
    updateActionAssignment(actionId, draft)
    setDetailAction((current) => current && current.id === actionId
      ? {
          ...current,
          owner: draft.owner.trim(),
          dueDate: draft.dueDate,
          editedByHr: true,
          updatedAt: now,
          history: [...current.history, { timestamp: now, type: 'edited', description: 'Owner or due date updated by HR.' }],
        }
      : current)
  }

  const handleDeliveryChange = (actionId: string, draft: ActionDeliveryDraft): void => {
    const now = new Date().toISOString()
    updateActionDelivery(actionId, draft)
    setDetailAction((current) => current && current.id === actionId
      ? {
          ...current,
          delivery: {
            ...draft,
            affectedGroup: draft.affectedGroup?.trim() || undefined,
            deliveryNote: draft.deliveryNote?.trim() || undefined,
            coveragePercentage: draft.intendedAudienceCount && draft.reachedAudienceCount !== undefined
              ? Math.round((draft.reachedAudienceCount / draft.intendedAudienceCount) * 1000) / 10
              : undefined,
          },
          updatedAt: now,
          history: [...current.history, {
            timestamp: now,
            type: 'delivery-updated',
            description: `Delivery status updated to ${draft.status}.`,
          }],
        }
      : current)
  }

  const handleReset = (): void => {
    resetDemo()
    setReviewing(null)
    setDetailAction(null)
    setReviewFilter('pending-review')
    setStatusFilter('all')
    setTab('recommendations')
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Actions"
        description="Turn workforce insights into accountable interventions with clear ownership and measurable outcomes."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">Human approval required</Badge>
            <InfoHint label="action recommendation rules" hint={ACTION_RULES_NOTE} />
            <ResetDemoMenu
              label="Reset demo"
              menuAriaLabel="Action Centre options"
              confirmTitle="Reset demo actions?"
              confirmDescription="This will remove locally approved and rejected recommendations. Official dataset actions will not be changed."
              onReset={handleReset}
            />
          </div>
        }
      />

      {error ? <DatasetError message={error} onRetry={retry} /> : null}

      {isLoading ? <ActionsSkeleton /> : null}

      {!isLoading && !error ? (
        <div className="space-y-6">
          <ActionSummary recommendations={recommendations} activeActions={activeActions} />

          <Tabs value={tab} onValueChange={(value) => setTab(value as ActionTabKey)}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {ACTION_TABS.map((entry) => (
                <TabsTrigger key={entry.key} value={entry.key}>
                  {entry.label}
                  {entry.key === 'recommendations' && pendingCount > 0
                    ? ` · ${formatCount(pendingCount)}`
                    : ''}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="recommendations" className="space-y-4 pt-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{ACTION_TABS[0].description}</p>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Select
                    value={reviewFilter}
                    onValueChange={(value) => setReviewFilter(value as ReviewFilterKey)}
                  >
                    <SelectTrigger className="w-[11rem]" aria-label="Filter by review status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_FILTERS.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={priorityFilter}
                    onValueChange={(value) => setPriorityFilter(value as PriorityFilterKey)}
                  >
                    <SelectTrigger className="w-[9.5rem]" aria-label="Filter by priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_FILTERS.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {shownRecommendations.length === 0 ? (
                <Card>
                  <CardContent>
                    <EmptyState
                      icon={ShieldCheck}
                      title="No actions currently require HR review."
                      description="Group-level priority issues and supported signals appear here for HR review."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {shownRecommendations.map((recommendation) => (
                    <RecommendationCard
                      key={recommendation.id}
                      recommendation={recommendation}
                      onReview={setReviewing}
                      privacySuppressed={isGroupScopeSuppressed(recommendation.impactScope, recommendation.evidenceSources, analytics)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active" className="space-y-4 pt-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{ACTION_TABS[1].description}</p>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilterKey)}
                >
                  <SelectTrigger className="w-[10.5rem] shrink-0" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {shownActions.length === 0 ? (
                <Card>
                  <CardContent>
                    <EmptyState
                      icon={ListChecks}
                      title="No approved actions yet."
                      description="Approve a recommendation and it will appear here with its owner, deadline and success measure."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {shownActions.map((action) => (
                    <ActiveActionCard
                      key={action.id}
                      action={action}
                      today={today}
                      onStatusChange={handleStatusChange}
                      onOpenDetail={setDetailAction}
                      privacySuppressed={isGroupScopeSuppressed(action.impactScope, action.evidenceSources ?? [], analytics)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">{ACTION_TABS[2].description}</p>
              {completedActions.length === 0 ? (
                <Card>
                  <CardContent>
                    <EmptyState
                      icon={ListChecks}
                      title="No completed actions yet."
                      description="Completed activities will appear here without claiming the HR outcome improved."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {completedActions.map((action) => (
                    <ActiveActionCard
                      key={action.id}
                      action={action}
                      today={today}
                      onStatusChange={handleStatusChange}
                      onOpenDetail={setDetailAction}
                      privacySuppressed={isGroupScopeSuppressed(action.impactScope, action.evidenceSources ?? [], analytics)}
                    />
                  ))}
                </div>
              )}
              {cancelledActions.length > 0 ? (
                <section className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-medium">Cancelled action history</h3>
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                    {cancelledActions.map((action) => (
                      <ActiveActionCard
                        key={action.id}
                        action={action}
                        today={today}
                        onStatusChange={handleStatusChange}
                        onOpenDetail={setDetailAction}
                        privacySuppressed={isGroupScopeSuppressed(action.impactScope, action.evidenceSources ?? [], analytics)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </TabsContent>

            <TabsContent value="existing" className="pt-2">
              <Card className="min-w-0">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Official Action Tracker</CardTitle>
                    <Badge variant="outline" className="ml-auto shrink-0">
                      Official Dataset
                    </Badge>
                  </div>
                  <CardDescription>
                    {ACTION_TABS[3].description} These records are read-only and are never modified
                    by this prototype.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExistingActionsTable actions={officialActions} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            {storageAvailable
              ? LOCAL_STORAGE_NOTE
              : `${LOCAL_STORAGE_NOTE} Local storage is unavailable, so changes last for this session only.`}{' '}
            Official dataset actions are read from the workbook on every load.
          </p>
        </div>
      ) : null}

      <ActionReviewSheet
        recommendation={reviewing}
        onClose={() => setReviewing(null)}
        onApprove={approveAction}
        onReject={rejectRecommendation}
      />

      <ActionDetailSheet
        action={detailAction}
        today={today}
        onClose={() => setDetailAction(null)}
        onUpdateAssignment={handleAssignmentChange}
        onUpdateDelivery={handleDeliveryChange}
        privacySuppressed={detailAction ? isGroupScopeSuppressed(detailAction.impactScope, detailAction.evidenceSources ?? [], analytics) : false}
      />
    </div>
  )
}
