import { DatasetError } from '@/components/dataset-status'
import { ActionProgress } from '@/components/dashboard/action-progress'
import { AttentionToday } from '@/components/dashboard/attention-today'
import { ManagementAttention } from '@/components/insights/management-attention'
import { DecisionLoopCard } from '@/components/dashboard/decision-loop-card'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { DivisionOverview } from '@/components/dashboard/division-overview'
import { ExitReasons } from '@/components/dashboard/exit-reasons'
import { MetricCard, type MetricCardProps } from '@/components/dashboard/metric-card'
import { NewJoinerHealth } from '@/components/dashboard/new-joiner-health'
import { PulseTrendChart } from '@/components/dashboard/pulse-trend-chart'
import { WorkforceSnapshot } from '@/components/dashboard/workforce-snapshot'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { METRIC_HINTS } from '@/data/dashboard.constants'
import { NEW_JOINER_MAX_MONTHS, SCORE_SCALE } from '@/data/hr-analytics.constants'
import { useHrImpact } from '@/hooks/use-hr-impact'
import { useHrAutomations } from '@/hooks/use-hr-automations'
import type { HrAnalytics } from '@/types/hr-analytics'
import {
  formatChangeLabel,
  formatCount,
  formatDate,
  formatPercentage,
  formatScoreOutOf,
} from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

/**
 * Composition only. Every number comes from the Step 4 analytics layer, which
 * reads the official workbook — nothing on this page is calculated here.
 */
function buildKpis(analytics: HrAnalytics): MetricCardProps[] {
  const { overview, pulse, onboarding } = analytics
  const change = pulse.engagementChange

  return [
    {
      label: 'Total Employees',
      value: formatCount(overview.totalEmployees),
      description: `${formatCount(overview.activeEmployees)} active · ${formatCount(overview.leavers)} leavers`,
      hint: METRIC_HINTS.totalEmployees,
    },
    {
      label: 'Leaver Rate',
      value: formatPercentage(overview.leaverRate),
      description: 'Share of employees marked as Leaver',
      hint: METRIC_HINTS.leaverRate,
    },
    {
      label: 'Exit Records',
      value: formatCount(overview.leavers),
      description: `${formatCount(analytics.exits.responseCount)} exit survey responses`,
      hint: METRIC_HINTS.exitRecords,
    },
    {
      label: 'Pulse Engagement',
      value: canShowGroupDetail(overview.latestPulse.responseCount)
        ? formatScoreOutOf(overview.latestPulse.engagement, SCORE_SCALE.max)
        : PRIVACY_SUPPRESSED_MESSAGE,
      description: overview.latestPulse.wave
        ? `Latest wave · ${overview.latestPulse.wave}`
        : undefined,
      hint: METRIC_HINTS.pulseEngagement,
      // Shown only when the analytics layer actually measured a change.
      trend: change
        ? {
            direction: change.direction,
            label: formatChangeLabel(change.absoluteChange, change.direction, 'first wave'),
          }
        : undefined,
    },
    {
      label: 'New Joiner Experience',
      value: onboarding.newJoiners && canShowGroupDetail(onboarding.newJoiners.responseCount)
        ? formatScoreOutOf(onboarding.newJoiners.averageOverallScore, SCORE_SCALE.max)
        : onboarding.newJoiners ? PRIVACY_SUPPRESSED_MESSAGE : '—',
      description: `Employees within first ${NEW_JOINER_MAX_MONTHS} months`,
      hint: METRIC_HINTS.newJoiner,
    },
    {
      label: 'Open Actions',
      value: formatCount(overview.openActions),
      description: `${formatCount(analytics.actions.completedActions)} completed of ${formatCount(overview.totalActions)}`,
      hint: METRIC_HINTS.openActions,
    },
  ]
}

export function OverviewPage() {
  const {
    analytics,
    intelligenceItems,
    topPriorityItems,
    recommendations,
    activeAutomations,
    isLoading,
    error,
    retry,
  } =
    useHrAutomations()
  const { summary: impactSummary, demoActions } = useHrImpact()
  const topPriority = topPriorityItems[0] ?? null
  const pendingRecommendations = recommendations.filter(
    (entry) => entry.reviewStatus === 'pending-review',
  ).length

  return (
    <div className="w-full space-y-8">
      <section className="border-b pb-6">
        <PageHeader
          title="Overview"
          description="Workforce health and management attention at a glance."
          actions={
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Badge variant="outline">Official Dummy Dataset</Badge>
              {analytics ? (
                <p className="text-xs text-muted-foreground">
                  {formatCount(analytics.overview.totalEmployees)} employees loaded · data through{' '}
                  {formatDate(analytics.overview.latestPulse.date)}
                </p>
              ) : null}
            </div>
          }
        />
      </section>

      {error ? <DatasetError message={error} onRetry={retry} /> : null}

      {isLoading ? <DashboardSkeleton /> : null}

      {analytics ? (
        <div className="space-y-6">
          <section className="space-y-4" aria-labelledby="overview-kpis-title">
            <div className="space-y-1"><h2 id="overview-kpis-title" className="text-lg font-semibold tracking-tight">Workforce Snapshot</h2><p className="text-sm text-muted-foreground">Key workforce and employee-experience indicators.</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {buildKpis(analytics).map((kpi) => (
                <MetricCard key={kpi.label} {...kpi} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <PulseTrendChart
                trend={analytics.pulse.trend}
                latest={analytics.pulse.trend[analytics.pulse.trend.length - 1] ?? null}
                workload={analytics.pulse.workload}
              />
            </div>
            <NewJoinerHealth
              newJoinerCount={analytics.employees.newJoiners.newJoinerCount}
              onboarding={analytics.onboarding.newJoiners}
              weakestDimension={analytics.onboarding.weakestDimension}
              onboardingResponseCount={analytics.onboarding.responseCount}
            />
          </div>

          <WorkforceSnapshot
            topPriority={
              topPriority
                ? { id: topPriority.insight.id, title: topPriority.insight.title }
                : null
            }
            highestLeaverRateDivision={analytics.employees.highestLeaverRateDivision}
            weakestOnboardingDimension={analytics.onboarding.weakestDimension}
            engagementChange={analytics.pulse.engagementChange}
            topExitReason={analytics.exits.topExitReasons[0] ?? null}
            exitResponseCount={analytics.exits.responseCount}
            onboardingResponseCount={analytics.onboarding.responseCount}
          />

          <DivisionOverview divisions={analytics.divisions} />

          <section className="space-y-4 border-t pt-7" aria-labelledby="overview-attention-title">
            <div className="space-y-1"><h2 id="overview-attention-title" className="text-lg font-semibold tracking-tight">Priority Workforce Signals</h2><p className="text-sm text-muted-foreground">Group-level signals that may require HR review.</p></div>
            <ManagementAttention
              items={intelligenceItems}
              analytics={analytics}
              groupOnly
              alwaysVisible
            />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AttentionToday items={activeAutomations} totalActive={activeAutomations.length} />
            <ActionProgress
              actions={analytics.actions}
              pendingRecommendations={pendingRecommendations}
            />
          </div>

          {/* Only once HR has approved something, so a fresh demo stays clean. */}
          {demoActions.length > 0 ? (
            <DecisionLoopCard
              summary={impactSummary}
              hasInsights={topPriorityItems.length > 0}
              hasApprovedActions
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ExitReasons
              reasons={analytics.exits.topExitReasons}
              responseCount={analytics.exits.responseCount}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
