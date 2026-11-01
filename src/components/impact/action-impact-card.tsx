import { ArrowRight, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import type { ActionImpact, ImpactMeasurement } from '@/types/hr-impact'
import { buildActionLoopStages } from '@/utils/decision-loop'
import { EMPTY_VALUE, formatDelta, formatPercentage } from '@/utils/format'
import { formatImpactChange, formatImpactValue, impactScaleSuffix } from '@/utils/hr-impact-view'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type ActionImpactCardProps = {
  impact: ActionImpact
  /** True when a deep link targeted this action. */
  highlighted?: boolean
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`${strong ? 'text-xl font-semibold' : 'text-base font-medium'} break-words tabular-nums`}>
        {value}
      </dd>
    </div>
  )
}

/** Baseline, current and target in one row; the change and progress beneath. */
function ResultSummary({ impact, measurement }: { impact: ActionImpact; measurement: ImpactMeasurement }) {
  const { unit, baselineValue, currentValue, targetValue, difference, progressToTarget } = measurement
  const suffix = impactScaleSuffix(unit)
  const show = (value: number | null): string =>
    value === null ? EMPTY_VALUE : `${formatImpactValue(value, unit)}${suffix}`
  const hasCurrent = currentValue !== null

  return (
    <div className="space-y-3">
      <dl className={`grid gap-4 ${hasCurrent ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Figure label="Baseline" value={show(baselineValue)} />
        {hasCurrent ? <Figure label="Current" value={show(currentValue)} strong /> : null}
        <Figure label="Target" value={targetValue === null ? 'No numeric target' : show(targetValue)} />
      </dl>

      {hasCurrent ? (
        <div className="space-y-1.5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
            <span className="text-base font-semibold">{formatImpactChange(difference, unit)}</span>
            <span className="text-muted-foreground">since baseline</span>
            {progressToTarget === null ? null : (
              <span className="text-muted-foreground">· {formatPercentage(progressToTarget, 0)} toward target</span>
            )}
          </p>
          {progressToTarget === null ? null : (
            <Progress
              value={progressToTarget}
              aria-label={`Progress from baseline toward target for ${measurement.label}`}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Next measurement: {impact.nextMeasurementLabel}</p>
      )}
    </div>
  )
}

/**
 * One action, and what is known about whether anything changed after it.
 *
 * The card keeps three questions visibly separate: was the action carried out,
 * is there a later reading, and did that reading reach the target. It never
 * collapses them into a single verdict, and it never says the action caused the
 * change — only that the metric was observed after completion.
 *
 * Summary first: the result is readable collapsed; measurement details, full
 * analysis and the decision loop sit behind one "View full analysis" control.
 */
export function ActionImpactCard({ impact, highlighted = false }: ActionImpactCardProps) {
  const { measurement } = impact
  const [open, setOpen] = useState(false)
  const isOfficial = impact.origin === 'official-dataset'
  const measurementPrivacySuppressed = measurement !== null && (
    !canShowGroupDetail(measurement.baselineSampleSize) ||
    (measurement.currentValue !== null && !canShowGroupDetail(measurement.currentSampleSize))
  )
  const sampleSize = measurement?.currentSampleSize ?? measurement?.baselineSampleSize ?? null

  /* A deep link lands on a card the reader asked for, so it opens. */
  useEffect(() => {
    if (highlighted) setOpen(true)
  }, [highlighted])

  const context = [impact.issueTitle, impact.affectedScope].filter(Boolean).join(' · ')

  return (
    <Card
      id={`impact-${impact.actionId}`}
      className={`min-w-0 scroll-mt-20 ${highlighted ? 'ring-2 ring-foreground/40' : ''}`}
    >
      <CardHeader className="gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ActionStatusBadge status={impact.actionStatus} />
          <span className="flex flex-wrap items-center gap-1.5">
            <OutcomeStatusBadge status={impact.outcomeStatus} />
            {measurement && measurement.targetStatus !== 'not-measured' ? (
              <TargetStatusBadge status={measurement.targetStatus} />
            ) : null}
          </span>
        </div>
        <CardTitle className="text-base leading-snug break-words">{impact.actionTitle}</CardTitle>
        <p className="text-sm break-words text-muted-foreground">
          {[context, impact.owner ? `Owner ${impact.owner}` : null].filter(Boolean).join(' · ') || EMPTY_VALUE}
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {measurement && !measurementPrivacySuppressed ? (
          <ResultSummary impact={impact} measurement={measurement} />
        ) : measurement ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {PRIVACY_SUPPRESSED_MESSAGE}
          </p>
        ) : null}

        <p className="line-clamp-2 text-sm text-muted-foreground">{impact.interpretation}</p>

        {measurement && measurement.comparisonQuality !== 'comparable' ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <ComparisonQualityBadge quality={measurement.comparisonQuality} />
            {sampleSize === null ? null : <span className="tabular-nums">n = {sampleSize.toLocaleString()}</span>}
          </p>
        ) : null}

        <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-sm font-medium transition-colors hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <span>{open ? 'Hide full analysis' : 'View full analysis'}</span>
            <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-4 space-y-5">
            <section className="space-y-3">
              <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Measurement details
              </h4>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-0.5 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Success metric</dt>
                  <dd className="text-sm break-words">{impact.successMetric}</dd>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Measurement source</dt>
                  <dd className="text-sm font-medium break-words">
                    {impact.dataSources.length > 0 ? impact.dataSources.join(' · ') : 'Not configured'}
                  </dd>
                </div>
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs text-muted-foreground">Record</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={isOfficial ? 'outline' : 'ghost'} className="text-muted-foreground">
                      {isOfficial ? 'Official Dataset' : 'Demo Action'}
                    </Badge>
                    <MeasurementStatusBadge status={impact.measurementStatus} />
                  </dd>
                </div>
              </dl>

              {measurement && !measurementPrivacySuppressed ? (
                <>
                  <BeforeAfterMetric measurement={measurement} />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Measurement timeline</p>
                    <MeasurementTimeline impact={impact} />
                  </div>
                </>
              ) : null}
            </section>

            <section className="space-y-3 border-t pt-4">
              <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Analysis details
              </h4>
              <div className="min-w-0 space-y-1">
                <p className="text-sm break-words">{impact.interpretation}</p>
                {measurement?.note ? (
                  <p className="text-xs break-words text-muted-foreground">{measurement.note}</p>
                ) : null}
              </div>

              {/* Context, not a control group: the same metric across the same waves. */}
              {!measurementPrivacySuppressed && measurement?.companyDifference !== undefined && measurement.difference !== null ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">Affected group change</dt>
                    <dd className="text-sm font-medium tabular-nums">{formatDelta(measurement.difference)}</dd>
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
            </section>

            <section className="space-y-3 border-t pt-4">
              <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Decision loop
              </h4>
              <DecisionLoop
                stages={buildActionLoopStages({
                  hasInsight: impact.insightId !== undefined || impact.issueId !== undefined,
                  actionApproved: true,
                  measurementStatus: impact.measurementStatus,
                })}
              />
            </section>

            {impact.insightId || impact.issueId || impact.sourceRecommendationId ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
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
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
