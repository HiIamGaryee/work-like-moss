import { ChartNoAxesCombined } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DatasetError } from '@/components/dataset-status'
import { EmptyState } from '@/components/empty-state'
import { ActionImpactCard } from '@/components/impact/action-impact-card'
import { ImpactSummary } from '@/components/impact/impact-summary'
import { MeasurementMethod } from '@/components/impact/measurement-method'
import { PageHeader } from '@/components/layout/page-header'
import { InfoHint } from '@/components/dashboard/info-hint'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IMPACT_RULES_NOTE } from '@/data/hr-impact-rules'
import { useHrImpact } from '@/hooks/use-hr-impact'
import type { ActionImpact } from '@/types/hr-impact'

const IMPACT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'measured', label: 'Measured' },
  { key: 'awaiting', label: 'Awaiting measurement' },
  { key: 'completed', label: 'Completed actions' },
  { key: 'not-comparable', label: 'Not comparable' },
] as const

type ImpactTabKey = (typeof IMPACT_TABS)[number]['key']

const MATCHERS: Record<ImpactTabKey, (impact: ActionImpact) => boolean> = {
  all: () => true,
  measured: (impact) => impact.measurementStatus === 'measurement-available',
  awaiting: (impact) => impact.measurementStatus === 'awaiting-measurement',
  completed: (impact) => impact.actionStatus === 'completed',
  'not-comparable': (impact) => impact.measurementStatus === 'not-comparable',
}

function ImpactSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
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
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/**
 * The Impact Tracker — the stage most HR dashboards leave out.
 *
 * It answers one question per action: is there a later reading of the measure
 * that action targeted, and did it move? Where the workbook holds readings on
 * both sides of a completed action, a real before-and-after is shown. Where
 * it does not, the page says "awaiting measurement" — which is a credible
 * outcome, and the only honest one. No survey wave is simulated, no result is
 * projected, and no card claims an action caused a change.
 *
 * Composition only: cards, readouts and the method note live in
 * `components/impact`.
 */
export function ImpactPage() {
  const { impacts, summary, isLoading, error, retry } = useHrImpact()

  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<ImpactTabKey>('all')
  const [focusId, setFocusId] = useState<string | null>(null)

  const requestedAction = searchParams.get('action')

  /**
   * `/impact?action=<id>` arrives from the Action Centre. The card is
   * highlighted and scrolled to, then the parameter is consumed so a later tab
   * change is not overridden by a stale link.
   */
  useEffect(() => {
    if (!requestedAction || isLoading) return

    if (impacts.some((impact) => impact.actionId === requestedAction)) {
      setTab('all')
      setFocusId(requestedAction)
      document
        .getElementById(`impact-${requestedAction}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('action')
        return next
      },
      { replace: true },
    )
  }, [requestedAction, isLoading, impacts, setSearchParams])

  const shown = useMemo(() => impacts.filter(MATCHERS[tab]), [impacts, tab])

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Impact"
        description="Track observable metric movement after completed HR actions without treating timing as proof of causation."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">Official data only</Badge>
            <InfoHint label="impact measurement rules" hint={IMPACT_RULES_NOTE} />
          </div>
        }
      />

      {error ? <DatasetError message={error} onRetry={retry} /> : null}

      {isLoading ? <ImpactSkeleton /> : null}

      {!isLoading && !error ? (
        <div className="space-y-6">
          <ImpactSummary summary={summary} />

          <section className="space-y-4">
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Action impact tracker</h2>
              <p className="text-sm text-muted-foreground">
                Actions awaiting a later reading first, followed by measured outcomes.
              </p>
            </div>

            <Tabs value={tab} onValueChange={(value) => setTab(value as ImpactTabKey)}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {IMPACT_TABS.map((entry) => (
                  <TabsTrigger key={entry.key} value={entry.key}>
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {shown.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={ChartNoAxesCombined}
                    title={
                      impacts.length === 0
                        ? 'No actions are being tracked yet.'
                        : 'No actions match this filter.'
                    }
                    description={
                      impacts.length === 0
                        ? 'Approve a recommendation in the Action Centre and its baseline, target and measurement status will appear here.'
                        : 'Other tabs may still contain tracked actions.'
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {shown.map((impact) => (
                  <ActionImpactCard
                    key={impact.actionId}
                    impact={impact}
                    highlighted={impact.actionId === focusId}
                  />
                ))}
              </div>
            )}
          </section>

          <MeasurementMethod />
        </div>
      ) : null}
    </div>
  )
}
