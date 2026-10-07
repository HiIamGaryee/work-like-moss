import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type {
  ChangeDirection,
  ChangeMetric,
  DivisionEmployeeMetric,
  ExitReasonMetric,
  OnboardingDimensionMetric,
} from '@/types/hr-analytics'
import {
  EMPTY_VALUE,
  formatChangeLabel,
  formatCount,
  formatPercentage,
  formatScoreOutOf,
} from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type WorkforceSnapshotProps = {
  /** Highest-priority detected signal, if the intelligence layer found one. */
  topPriority: { id: string; title: string } | null
  highestLeaverRateDivision: DivisionEmployeeMetric | null
  weakestOnboardingDimension: OnboardingDimensionMetric | null
  engagementChange: ChangeMetric | null
  topExitReason: ExitReasonMetric | null
  exitResponseCount: number
  onboardingResponseCount: number
}

const DIRECTION_ICONS: Record<ChangeDirection, ComponentType<{ className?: string }>> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
}

const DIRECTION_WORDS: Record<ChangeDirection, string> = {
  up: 'Up',
  down: 'Down',
  flat: 'Flat',
}

/**
 * Facts read straight off the analytics layer — a maximum, a minimum, a
 * measured change and a frequency. No interpretation, no cause, no ranking of
 * urgency; that arrives with the AI and prioritisation steps.
 */
export function WorkforceSnapshot({
  topPriority,
  highestLeaverRateDivision,
  weakestOnboardingDimension,
  engagementChange,
  topExitReason,
  exitResponseCount,
  onboardingResponseCount,
}: WorkforceSnapshotProps) {
  const snapshotItems = [
    {
      key: 'leavers',
      label: 'Highest leaver share',
      primary: highestLeaverRateDivision?.division ?? EMPTY_VALUE,
      secondary: highestLeaverRateDivision && canShowGroupDetail(highestLeaverRateDivision.employeeCount)
        ? `${formatPercentage(highestLeaverRateDivision.leaverRate)} of ${highestLeaverRateDivision.employeeCount} employees`
        : highestLeaverRateDivision ? PRIVACY_SUPPRESSED_MESSAGE : 'No division data',
      direction: null,
    },
    {
      key: 'onboarding',
      label: 'Lowest onboarding dimension',
      primary: weakestOnboardingDimension && canShowGroupDetail(onboardingResponseCount) ? weakestOnboardingDimension.label : weakestOnboardingDimension ? 'Onboarding analytics' : EMPTY_VALUE,
      secondary: weakestOnboardingDimension && canShowGroupDetail(onboardingResponseCount)
        ? formatScoreOutOf(weakestOnboardingDimension.score, SCORE_SCALE.max)
        : weakestOnboardingDimension ? PRIVACY_SUPPRESSED_MESSAGE : 'No onboarding data',
      direction: null,
    },
    {
      key: 'pulse',
      label: 'Pulse engagement',
      primary: engagementChange ? DIRECTION_WORDS[engagementChange.direction] : EMPTY_VALUE,
      secondary: engagementChange
        ? formatChangeLabel(
            engagementChange.absoluteChange,
            engagementChange.direction,
            engagementChange.fromLabel,
          )
        : 'Needs two or more waves',
      direction: engagementChange?.direction ?? null,
    },
    {
      key: 'exit',
      label: 'Most common exit reason',
      primary: topExitReason && canShowGroupDetail(exitResponseCount) ? topExitReason.reason : topExitReason ? 'Exit analytics' : EMPTY_VALUE,
      secondary: topExitReason && canShowGroupDetail(exitResponseCount)
        ? `${topExitReason.count} of ${formatCount(exitResponseCount)} responses · ${formatPercentage(topExitReason.percentage)}`
        : 'No exit survey data',
      direction: null,
    },
  ] as const

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workforce Snapshot</CardTitle>
        <CardDescription>
          Recorded facts from the dataset, without interpretation.
        </CardDescription>
        <CardAction>
          <Link
            to={topPriority ? `/insights/${topPriority.id}` : '/insights'}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {topPriority ? 'View highest-priority analysis' : 'View all insights'}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {snapshotItems.map(({ key, label, primary, secondary, direction }) => {
            const DirectionIcon = direction ? DIRECTION_ICONS[direction] : null
            return (
              <div key={key} className="space-y-1">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="flex items-center gap-1.5 text-base font-medium">
                  {DirectionIcon ? (
                    <DirectionIcon className="size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                  {primary}
                </dd>
                <p className="text-xs tabular-nums text-muted-foreground">{secondary}</p>
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}
