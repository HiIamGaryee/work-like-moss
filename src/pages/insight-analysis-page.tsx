import { SearchX, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RecommendedNextStep } from '@/components/actions/recommended-next-step'
import { DatasetError } from '@/components/dataset-status'
import { EmptyState } from '@/components/empty-state'
import { EvidenceTrail } from '@/components/insights/evidence-trail'
import { InsightAnalysisHeader } from '@/components/insights/insight-analysis-header'
import { InvestigationAreas } from '@/components/insights/investigation-areas'
import { AiDraftPanel } from '@/components/insights/ai-draft-panel'
import { IssueEvidenceSection } from '@/components/insights/issue-evidence-section'
import { LikelyDriverCard } from '@/components/insights/likely-driver-card'
import { PriorityScoreCard } from '@/components/insights/priority-score-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CAUSATION_DISCLAIMER, NO_DRIVER_MESSAGE } from '@/data/hr-root-cause-rules'
import { useHrImpact } from '@/hooks/use-hr-impact'
import { isInsightDetailSuppressed } from '@/utils/insight-privacy'
import {
  buildHrAiDraftInput,
  generateHrDraft,
  getFallbackHrDraft,
  isHrAiEnabled,
} from '@/services/hr-ai-draft.service'

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
  const { analytics, intelligenceItems, recommendations, demoActions, impacts, isLoading, error, retry } =
    useHrImpact()

  const item = intelligenceItems.find((entry) => entry.insight.id === insightId) ?? null
  const recommendation = recommendations.find((entry) => entry.insightId === insightId) ?? null
  const linkedAction =
    demoActions.find((action) => action.sourceRecommendationId === recommendation?.id) ?? null
  const linkedImpact = impacts.find((impact) => impact.actionId === linkedAction?.id) ?? null
  const [aiState, setAiState] = useState<{ insightId: string; result: Awaited<ReturnType<typeof getFallbackHrDraft>> } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

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
  const privacySuppressed = isInsightDetailSuppressed(item, analytics)
  const visibleDrivers = privacySuppressed ? [] : likelyDrivers
  const aiInput = buildHrAiDraftInput(item, analytics, recommendation)
  const aiEnabled = isHrAiEnabled()
  const aiResult = aiState !== null && aiState.insightId === insightId
    ? aiState.result
    : privacySuppressed
      ? { draft: null, source: 'rule-based' as const, available: false, message: 'Insufficient responses for AI-assisted analysis.' }
      : getFallbackHrDraft(item, recommendation)

  const handleGenerateAiDraft = async (): Promise<void> => {
    if (!aiInput || aiLoading) return
    setAiLoading(true)
    const result = await generateHrDraft(aiInput, item, recommendation)
    setAiState({ insightId: insight.id, result })
    setAiLoading(false)
  }

  return (
    <div className="w-full space-y-6">
      <InsightAnalysisHeader
        insight={insight}
        priority={priority}
        privacySuppressed={privacySuppressed}
      />

      <IssueEvidenceSection item={item} analytics={analytics} drivers={visibleDrivers} />

      <AiDraftPanel
        draft={aiResult.draft}
        source={aiResult.source}
        message={aiResult.message}
        loading={aiLoading}
        canGenerate={aiInput !== null && aiEnabled}
        onGenerate={handleGenerateAiDraft}
        recommendation={privacySuppressed ? null : recommendation}
        aiEnabled={aiEnabled}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Possible Explanation</CardTitle>
              <CardDescription>{CAUSATION_DISCLAIMER}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleDrivers.length === 0 ? (
                <EmptyState icon={Sparkles} title={NO_DRIVER_MESSAGE} />
              ) : (
                visibleDrivers.map((driver, index) => (
                  <LikelyDriverCard key={driver.id} driver={driver} rank={index + 1} />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {privacySuppressed ? (
          <Card>
            <CardHeader>
              <CardTitle>Priority Assessment</CardTitle>
              <CardDescription>Priority remains protected until the minimum response threshold is met.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Insufficient responses to display detailed priority evidence.</p>
            </CardContent>
          </Card>
        ) : (
          <PriorityScoreCard priority={priority} />
        )}
      </div>

      <InvestigationAreas drivers={visibleDrivers} />

      {recommendation && !privacySuppressed ? (
        <RecommendedNextStep
          recommendation={recommendation}
          action={linkedAction}
          measurementStatus={linkedImpact?.measurementStatus}
        />
      ) : null}

      {privacySuppressed ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              The evidence trail is hidden until comparable group responses are available.
            </p>
          </CardContent>
        </Card>
      ) : (
        <EvidenceTrail insight={insight} drivers={visibleDrivers} />
      )}
    </div>
  )
}
