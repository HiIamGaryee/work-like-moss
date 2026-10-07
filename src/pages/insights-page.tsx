import { ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DatasetError } from '@/components/dataset-status'
import { InfoHint } from '@/components/dashboard/info-hint'
import { EmptyState } from '@/components/empty-state'
import { InsightCard } from '@/components/insights/insight-card'
import { InsightOverview } from '@/components/insights/insight-overview'
import { ManagementAttention } from '@/components/insights/management-attention'
import { PageHeader } from '@/components/layout/page-header'
import { ProductPrinciples } from '@/components/product-principles'
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
import { DETECTION_RULES_NOTE, INSIGHT_TABS, type InsightTabKey } from '@/data/hr-insight-rules'
import {
  PRIORITY_FORMULA_NOTE,
  PRIORITY_LEVEL_LABELS,
  PRIORITY_LEVEL_ORDER,
} from '@/data/hr-priority-rules'
import { useHrIntelligence } from '@/hooks/use-hr-intelligence'
import { summariseInsights } from '@/services/hr-insights.service'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'

/** Central mappings, so no component repeats a filter or sort condition. */
const SORT_OPTIONS = [
  { key: 'priority', label: 'Priority' },
  { key: 'strength', label: 'Signal strength' },
  { key: 'change', label: 'Largest change' },
] as const

type SortKey = (typeof SORT_OPTIONS)[number]['key']

const PRIORITY_FILTERS = [
  { key: 'all', label: 'All priorities' },
  { key: 'critical', label: PRIORITY_LEVEL_LABELS.critical },
  { key: 'high', label: PRIORITY_LEVEL_LABELS.high },
  { key: 'medium', label: PRIORITY_LEVEL_LABELS.medium },
  { key: 'low', label: PRIORITY_LEVEL_LABELS.low },
] as const

type PriorityFilterKey = (typeof PRIORITY_FILTERS)[number]['key']

const STRENGTH_RANK = { strong: 0, moderate: 1, watch: 2 } as const

const SORTERS: Record<SortKey, (a: HrIntelligenceItem, b: HrIntelligenceItem) => number> = {
  priority: (a, b) =>
    PRIORITY_LEVEL_ORDER[a.priority.level] - PRIORITY_LEVEL_ORDER[b.priority.level] ||
    b.priority.score - a.priority.score,
  strength: (a, b) =>
    STRENGTH_RANK[a.insight.signalStrength] - STRENGTH_RANK[b.insight.signalStrength] ||
    b.priority.score - a.priority.score,
  change: (a, b) => Math.abs(b.insight.difference ?? 0) - Math.abs(a.insight.difference ?? 0),
}

function applyFilters(
  items: HrIntelligenceItem[],
  tab: InsightTabKey,
  priority: PriorityFilterKey,
  sort: SortKey,
): HrIntelligenceItem[] {
  const definition = INSIGHT_TABS.find((entry) => entry.key === tab)
  const allowed = definition?.categories ? new Set<string>(definition.categories) : null

  return [...items]
    .filter((item) => (allowed ? allowed.has(item.insight.category) : true))
    .filter((item) => (priority === 'all' ? true : item.priority.level === priority))
    .sort((a, b) => SORTERS[sort](a, b) || a.insight.id.localeCompare(b.insight.id))
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} size="sm" className="gap-2">
            <CardHeader>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function InsightsPage() {
  const { analytics, visibleItems, topPriorityItems, items, isLoading, error, retry } =
    useHrIntelligence()
  const [tab, setTab] = useState<InsightTabKey>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterKey>('all')
  const [sort, setSort] = useState<SortKey>('priority')

  const shown = useMemo(
    () => applyFilters(visibleItems, tab, priorityFilter, sort),
    [visibleItems, tab, priorityFilter, sort],
  )

  const summary = useMemo(
    () => summariseInsights(visibleItems.map((item) => item.insight)),
    [visibleItems],
  )

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Insights"
        description="Automatically detected workforce patterns from employee lifecycle and survey data."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">Prototype detection rules</Badge>
            <InfoHint
              label="detection and priority rules"
              hint={`${DETECTION_RULES_NOTE} ${PRIORITY_FORMULA_NOTE}`}
            />
          </div>
        }
      />

      {error ? <DatasetError message={error} onRetry={retry} /> : null}

      {isLoading ? <InsightsSkeleton /> : null}

      {analytics && !isLoading ? (
        <div className="space-y-6">
          <InsightOverview summary={summary} latestWave={analytics.overview.latestPulse.wave} />

          <ManagementAttention items={topPriorityItems} analytics={analytics} />

          {visibleItems.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={ShieldCheck}
                  title="No material workforce signals detected."
                  description="Current metrics remain within the configured monitoring thresholds."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs value={tab} onValueChange={(value) => setTab(value as InsightTabKey)}>
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {INSIGHT_TABS.map((entry) => (
                      <TabsTrigger key={entry.key} value={entry.key}>
                        {entry.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="flex shrink-0 items-center gap-2">
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

                  <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                    <SelectTrigger className="w-[10.5rem]" aria-label="Sort insights">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          Sort: {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {shown.length === 0 ? (
                <Card>
                  <CardContent>
                    <EmptyState
                      icon={ShieldCheck}
                      title="No signals match this filter."
                      description="Other categories or priority levels may still have detected signals."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {shown.map((item) => (
                    <InsightCard
                      key={item.insight.id}
                      insight={item.insight}
                      priority={item.priority}
                      analytics={analytics}
                      topDriverLabel={item.likelyDrivers[0]?.label ?? null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Showing {visibleItems.length} of {items.length} detected signals. Detection thresholds
              and priority weights are prototype management rules, not validated HR benchmarks.
            </p>
            <ProductPrinciples />
          </div>
        </div>
      ) : null}
    </div>
  )
}
