import { SearchX, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { RecommendedNextStep } from '@/components/actions/recommended-next-step'
import { DatasetError } from '@/components/dataset-status'
import { EmptyState } from '@/components/empty-state'
import { EvidenceTrail } from '@/components/insights/evidence-trail'
import { InsightAnalysisHeader } from '@/components/insights/insight-analysis-header'
import { LikelyDriverCard } from '@/components/insights/likely-driver-card'
import { PriorityScoreCard } from '@/components/insights/priority-score-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CAUSATION_DISCLAIMER, NO_DRIVER_MESSAGE } from '@/data/hr-root-cause-rules'
import { useHrImpact } from '@/hooks/use-hr-impact'

function AnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 2 }, (_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-24" />
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-3 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * The Root Cause Explorer: one detected issue, the related signals measured
 * around it, the transparent priority score, and the trail that produced both.
 */
export function InsightAnalysisPage() {
  const { insightId } = useParams<{ insightId: string }>()
  const { intelligenceItems, recommendations, demoActions, impacts, isLoading, error, retry } =
    useHrImpact()

  const item = intelligenceItems.find((entry) => entry.insight.id === insightId) ?? null
  const recommendation = recommendations.find((entry) => entry.insightId === insightId) ?? null
  const linkedAction =
    demoActions.find((action) => action.sourceRecommendationId === recommendation?.id) ?? null
  const linkedImpact = impacts.find((impact) => impact.actionId === linkedAction?.id) ?? null

  if (error) {
    return (
      <div className="w-full space-y-6">
        <DatasetError message={error} onRetry={retry} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <AnalysisSkeleton />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="w-full space-y-6">
        <Card>
          <CardContent className="space-y-4">
            <EmptyState
              icon={SearchX}
              title="Insight not found"
              description="This signal is not present in the current dataset."
            />
            <div className="flex justify-center">
              <Button variant="outline" size="sm" asChild>
                <Link to="/insights">Back to Insights</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { insight, likelyDrivers, priority } = item

  return (
    <div className="w-full space-y-6">
      <InsightAnalysisHeader insight={insight} priority={priority} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Likely Drivers</CardTitle>
              <CardDescription>{CAUSATION_DISCLAIMER}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {likelyDrivers.length === 0 ? (
                <EmptyState icon={Sparkles} title={NO_DRIVER_MESSAGE} />
              ) : (
                likelyDrivers.map((driver, index) => (
                  <LikelyDriverCard key={driver.id} driver={driver} rank={index + 1} />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <PriorityScoreCard priority={priority} />
      </div>

      {recommendation ? (
        <RecommendedNextStep
          recommendation={recommendation}
          action={linkedAction}
          measurementStatus={linkedImpact?.measurementStatus}
        />
      ) : null}

      <EvidenceTrail insight={insight} drivers={likelyDrivers} />
    </div>
  )
}
