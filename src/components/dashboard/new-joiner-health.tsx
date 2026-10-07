import { UserPlus } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { NEW_JOINER_MAX_MONTHS, SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { OnboardingDimensionMetric, OnboardingGroupMetric } from '@/types/hr-analytics'
import { formatCount, formatScoreOutOf, scoreToProgress } from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type NewJoinerHealthProps = {
  newJoinerCount: number
  onboarding: OnboardingGroupMetric | null
  weakestDimension: OnboardingDimensionMetric | null
  onboardingResponseCount: number
}

const SCORE_ROWS = [
  { key: 'averageOverallScore', label: 'Overall Experience' },
  { key: 'averageManagerSupport', label: 'Manager Support' },
  { key: 'averageRoleClarity', label: 'Role Clarity' },
  { key: 'averageToolsAccess', label: 'Tools Access' },
] as const satisfies readonly { key: keyof OnboardingGroupMetric; label: string }[]

export function NewJoinerHealth({
  newJoinerCount,
  onboarding,
  weakestDimension,
  onboardingResponseCount,
}: NewJoinerHealthProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>New Joiner Health</CardTitle>
        <CardDescription>
          Experience during the first {NEW_JOINER_MAX_MONTHS} months.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatCount(newJoinerCount)}
          </span>
          <span className="text-xs text-muted-foreground">new joiners</span>
        </div>

        {onboarding && canShowGroupDetail(onboarding.responseCount) ? (
          <>
            <dl className="space-y-3.5">
              {SCORE_ROWS.map(({ key, label }) => {
                const score = onboarding[key]
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-medium tabular-nums">
                        {formatScoreOutOf(score, SCORE_SCALE.max, 1)}
                      </dd>
                    </div>
                    {/* Progress width only — the analytics value stays on the 1–5 scale. */}
                    <Progress
                      value={scoreToProgress(score, SCORE_SCALE.max)}
                      aria-label={`${label} score`}
                    />
                  </div>
                )
              })}
            </dl>

            <p className="text-xs text-muted-foreground">
              Based on {formatCount(onboarding.responseCount)} onboarding responses.
            </p>
          </>
        ) : onboarding ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{PRIVACY_SUPPRESSED_MESSAGE}</p>
        ) : (
          <EmptyState icon={UserPlus} title="No onboarding responses from new joiners." />
        )}

        {weakestDimension && canShowGroupDetail(onboardingResponseCount) ? (
          <div className="space-y-0.5 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Lowest onboarding dimension · all responses
            </p>
            <p className="text-sm font-medium">{weakestDimension.label}</p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatScoreOutOf(weakestDimension.score, SCORE_SCALE.max)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
