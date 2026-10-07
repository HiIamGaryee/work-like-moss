import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AutomationRulesSheet } from '@/components/automations/automation-rules-sheet'
import { AutomationSummary } from '@/components/automations/automation-summary'
import { FollowUpQueue } from '@/components/automations/follow-up-queue'
import { MessageReviewSheet } from '@/components/automations/message-review-sheet'
import { ResponsibleAutomation } from '@/components/automations/responsible-automation'
import { DatasetError } from '@/components/dataset-status'
import { PageHeader } from '@/components/layout/page-header'
import { ResetDemoMenu } from '@/components/reset-demo-menu'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AUTOMATION_CATEGORIES,
  type AutomationCategoryKey,
} from '@/data/hr-automation-rules'
import { DEMO_EXTENSION_NOTE } from '@/data/hr-care-demo'
import { useHrAutomations } from '@/hooks/use-hr-automations'
import type { AutomationType, FollowUpStatus, HrAutomationItem } from '@/types/hr-automation'
import { formatCount } from '@/utils/format'

const INBOX_TABS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'handled', label: 'Handled' },
] as const

type InboxTabKey = (typeof INBOX_TABS)[number]['key']

function AutomationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} size="sm" className="gap-2">
            <CardHeader>
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-1/2" />
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
 * The HR Attention Inbox.
 *
 * This page answers one question: what should HR remember today that is easy to
 * forget? It reads employee lifecycle facts from the official workbook, care
 * records from clearly-labelled demo extension data, and deadlines from actions
 * HR already approved — then surfaces the moments a person would otherwise miss.
 *
 * It is not a scheduler and not a sender. Reminders are calculated in the browser
 * when the page loads; a message exists only after a person reviews it, and only
 * ever inside their own email client or WhatsApp.
 *
 * Composition only: cards, inbox and the message panel live in
 * `components/automations`.
 */
export function AutomationsPage() {
  const {
    summary,
    followUps,
    followUpSummary,
    updateFollowUpStatus,
    storageAvailable,
    isLoading,
    error,
    retry,
    markHandled,
    saveMessageEdit,
    resetAutomations,
  } = useHrAutomations()

  const [tab, setTab] = useState<InboxTabKey>('all')
  const [category, setCategory] = useState<AutomationCategoryKey>('all')
  const [reviewing, setReviewing] = useState<HrAutomationItem | null>(null)

  const shown = useMemo(() => {
    const definition = AUTOMATION_CATEGORIES.find((entry) => entry.key === category)
    const allowed = definition?.types ? new Set<AutomationType>(definition.types) : null

    return followUps
      .filter((item) => {
        if (tab === 'handled') return item.status === 'completed' || item.status === 'dismissed'
        if (tab === 'all') return item.status !== 'completed' && item.status !== 'dismissed'
        return item.status !== 'completed' && item.status !== 'dismissed' && item.priority === tab
      })
      .filter((item) => {
        if (!allowed) return true
        if (item.automation) return allowed.has(item.automation.type)
        if (category === 'onboarding') return item.type === 'onboarding-check-in'
        if (category === 'actions') return ['action-review', 'overdue-action', 'delivery-follow-up', 'outcome-review'].includes(item.type)
        return category === 'all'
      })
  }, [tab, category, followUps])

  const handleToggleHandled = (automationId: string, handled: boolean): void => {
    markHandled(automationId, handled)
    toast.success(handled ? 'Reminder marked as handled' : 'Reminder reopened')
  }

  const handleFollowUpStatus = (followUpId: string, status: FollowUpStatus): void => {
    const item = followUps.find((entry) => entry.id === followUpId)
    updateFollowUpStatus(followUpId, status)
    if (item?.automation && status === 'completed') markHandled(followUpId, true)
    if (item?.automation && status === 'open') markHandled(followUpId, false)
    toast.success(status === 'completed' ? 'Follow-up marked complete' : status === 'dismissed' ? 'Follow-up dismissed' : 'Follow-up reopened')
  }

  const handleReset = (): void => {
    resetAutomations()
    setReviewing(null)
    setTab('all')
    setCategory('all')
    toast.success('Automation demo reset')
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Automations"
        description="Surface timely employee-care and action reminders before important moments are missed."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Human approval required</Badge>
            <AutomationRulesSheet />
            <ResetDemoMenu
              label="Reset automation demo"
              menuAriaLabel="Automation options"
              confirmTitle="Reset automation demo?"
              confirmDescription="Handled reminders will become active again. Employee and action data will not be changed."
              onReset={handleReset}
            />
          </div>
        }
      />

      {error ? <DatasetError message={error} onRetry={retry} /> : null}

      {isLoading ? <AutomationsSkeleton /> : null}

      {!isLoading && !error ? (
        <div className="space-y-6">
          <AutomationSummary summary={summary} />

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: 'Overdue', value: followUpSummary.overdue },
              { label: 'Due soon', value: followUpSummary.dueSoon },
              { label: 'Open', value: followUpSummary.open },
            ].map((entry) => (
              <Card key={entry.label} size="sm" className="gap-2">
                <CardHeader><p className="text-xs text-muted-foreground">{entry.label}</p></CardHeader>
                <CardContent><p className="text-2xl font-semibold tracking-tight">{formatCount(entry.value)}</p></CardContent>
              </Card>
            ))}
          </div>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  Follow-Up Queue
                </h2>
                <p className="text-sm text-muted-foreground">
                  Onboarding checks, action reviews, delivery follow-ups and HR review work in one place.
                </p>
              </div>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as AutomationCategoryKey)}
              >
                <SelectTrigger className="w-[11rem] shrink-0" aria-label="Filter by category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTOMATION_CATEGORIES.map((entry) => (
                    <SelectItem key={entry.key} value={entry.key}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={tab} onValueChange={(value) => setTab(value as InboxTabKey)}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {INBOX_TABS.map((entry) => (
                  <TabsTrigger key={entry.key} value={entry.key}>
                    {entry.label}
                    {entry.key === 'handled' && followUpSummary.completed > 0
                      ? ` · ${formatCount(followUpSummary.completed)}`
                      : ''}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <FollowUpQueue
              items={shown}
              onReviewMessage={setReviewing}
              onStatusChange={handleFollowUpStatus}
            />
          </section>

          <ResponsibleAutomation />

          <p className="text-xs text-muted-foreground">
            {DEMO_EXTENSION_NOTE} Handled reminders are stored locally in this browser
            {storageAvailable ? '' : ', but local storage is unavailable, so they last for this session only'}
            .
          </p>
        </div>
      ) : null}

      <MessageReviewSheet
        item={reviewing}
        onClose={() => setReviewing(null)}
        onSaveMessage={saveMessageEdit}
        onMarkHandled={(automationId) => handleToggleHandled(automationId, true)}
      />
    </div>
  )
}
