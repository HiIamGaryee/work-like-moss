import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionStatusBadge } from '@/components/actions/action-status-badge'
import { BeforeAfterMetric } from '@/components/impact/before-after-metric'
import { DecisionLoop } from '@/components/impact/decision-loop'
import {
  ComparisonQualityBadge,
  MeasurementStatusBadge,
  OutcomeStatusBadge,
  TargetStatusBadge,
} from '@/components/impact/impact-status-badge'
import { MeasurementTimeline } from '@/components/impact/measurement-timeline'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ActionImpact } from '@/types/hr-impact'
import { buildActionLoopStages } from '@/utils/decision-loop'
import { EMPTY_VALUE, formatDelta } from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type ActionImpactCardProps = {
  impact: ActionImpact
  /** True when a deep link targeted this action. */
  highlighted?: boolean
}

/**
 * One action, and what is known about whether anything changed after it.
 *
 * The card keeps three questions visibly separate: was the action carried out,
 * is there a later reading, and did that reading reach the target. It never
 * collapses them into a single verdict, and it never says the action caused the
 * change — only that the metric was observed after completion.
 */
export function ActionImpactCard({ impact, highlighted = false }: ActionImpactCardProps) {
  const { measurement } = impact
  const isOfficial = impact.origin === 'official-dataset'
  const measurementPrivacySuppressed = measurement !== null && (
    !canShowGroupDetail(measurement.baselineSampleSize) ||
    (measurement.currentValue !== null && !canShowGroupDetail(measurement.currentSampleSize))
  )

  const facts = [
    { key: 'issue', label: 'Linked issue', value: impact.issueTitle || EMPTY_VALUE },
    { key: 'scope', label: 'Affected scope', value: impact.affectedScope || EMPTY_VALUE },
    { key: 'owner', label: 'Owner', value: impact.owner || EMPTY_VALUE },
    {
      key: 'source',
      label: 'Measurement source',
      value: impact.dataSources.length > 0 ? impact.dataSources.join(' · ') : 'Not configured',
    },
  ]

  return (
    <Card
      id={`impact-${impact.actionId}`}
      className={`min-w-0 scroll-mt-20 ${highlighted ? 'ring-2 ring-foreground/40' : ''}`}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isOfficial ? 'outline' : 'ghost'} className="text-muted-foreground">
            {isOfficial ? 'Official Dataset' : 'Demo Action'}
          </Badge>
          <ActionStatusBadge status={impact.actionStatus} />
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <MeasurementStatusBadge status={impact.measurementStatus} />
            <OutcomeStatusBadge status={impact.outcomeStatus} />
            {measurement && measurement.targetStatus !== 'not-measured' ? (
              <TargetStatusBadge status={measurement.targetStatus} />
            ) : null}
            {measurement ? <ComparisonQualityBadge quality={measurement.comparisonQuality} /> : null}
          </span>
        </div>
        <CardTitle className="text-base leading-snug break-words">{impact.actionTitle}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.key} className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm font-medium break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="min-w-0 space-y-0.5 border-t pt-3">
          <p className="text-xs text-muted-foreground">Success metric</p>
          <p className="text-sm break-words">{impact.successMetric}</p>
        </div>

        {/* Baseline and target are shown even while awaiting a later reading —
            an approved target with no result yet is the honest state, not a gap. */}
        {measurement && !measurementPrivacySuppressed ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BeforeAfterMetric measurement={measurement} />
            <div className="min-w-0 space-y-3 rounded-lg border p-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Measurement timeline
              </p>
              <MeasurementTimeline impact={impact} />
            </div>
          </div>
        ) : measurement ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{PRIVACY_SUPPRESSED_MESSAGE}</p> : null}

        {/* Context, not a control group: the same metric across the same waves. */}
        {!measurementPrivacySuppressed && measurement?.companyDifference !== undefined && measurement.difference !== null ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-dashed p-3">
            <div className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">Affected group change</dt>
              <dd className="text-sm font-medium tabular-nums">
                {formatDelta(measurement.difference)}
              </dd>
            </div>
            <div className="min-w-0 space-y-0.5">
              <dt className="text-xs text-muted-foreground">Company comparison</dt>
              <dd className="text-sm font-medium tabular-nums">
                {measurement.companyDifference === null
                  ? EMPTY_VALUE
                  : formatDelta(measurement.companyDifference)}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="min-w-0 space-y-0.5 border-t pt-3">
          <p className="text-xs text-muted-foreground">Interpretation</p>
          <p className="text-sm break-words">{impact.interpretation}</p>
          {measurement?.note ? (
            <p className="text-xs break-words text-muted-foreground">{measurement.note}</p>
          ) : null}
        </div>

        <div className="space-y-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">Decision loop</p>
          <DecisionLoop
            stages={buildActionLoopStages({
              hasInsight: impact.insightId !== undefined || impact.issueId !== undefined,
              actionApproved: true,
              measurementStatus: impact.measurementStatus,
            })}
          />
        </div>

        {impact.insightId || impact.issueId || impact.sourceRecommendationId ? (
          <>
            <Separator />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {impact.insightId ? (
                <Link
                  to={`/insights/${impact.insightId}`}
                  className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
                >
                  View original analysis
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : impact.issueId ? (
                <Link
                  to="/insights"
                  className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
                >
                  View priority analysis
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
              <Link
                to={impact.sourceRecommendationId
                  ? `/actions?recommendation=${encodeURIComponent(impact.sourceRecommendationId)}`
                  : '/actions'}
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-muted-foreground"
              >
                View action
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
