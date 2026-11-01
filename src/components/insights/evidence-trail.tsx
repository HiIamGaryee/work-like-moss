import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DATA_SOURCE_SHORT_LABELS,
  EVIDENCE_STAR_MAX,
  EVIDENCE_STRENGTH_RATING,
} from '@/data/dashboard.constants'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import { DRIVER_LABELS } from '@/data/hr-root-cause-rules'
import { cn } from '@/lib/utils'
import type { EvidenceStrength, HrInsight, InsightStrength, LikelyDriver } from '@/types/hr-insights'
import { EMPTY_VALUE, formatCount, formatDelta, formatPercentage, formatScoreOutOf } from '@/utils/format'

type EvidenceTrailProps = {
  insight: HrInsight
  drivers: LikelyDriver[]
}

type TrailNode = {
  id: string
  stage: string
  isDetected: boolean
  sources: string[]
  metric: string
  value: string
  comparison: string | null
  /** The engine's own strength field; the trail only maps it to stars. */
  strength: EvidenceStrength | InsightStrength
}

const renderValue = (value: number | string, format: string | undefined): string => {
  if (typeof value === 'string') return value === '' ? EMPTY_VALUE : value
  if (!Number.isFinite(value)) return EMPTY_VALUE
  if (format === 'percentage') return formatPercentage(value)
  if (format === 'count') return formatCount(value)
  if (format === 'delta' || format === 'points') return formatDelta(value)
  if (format === 'multiplier') return `${value.toFixed(2)}×`
  if (format === 'ratio') return value.toFixed(2)
  return formatScoreOutOf(value, SCORE_SCALE.max)
}

/**
 * The chain the engine actually walked: the detected signal, then every
 * supporting measure it found in each dataset, then the drivers it named. This
 * is the audit trail — nothing appears here that is not in the evidence above.
 */
function buildTrail(insight: HrInsight, drivers: LikelyDriver[]): TrailNode[] {
  const detected: TrailNode = {
    id: 'detected',
    stage: 'Detected signal',
    isDetected: true,
    sources: insight.dataSources.map((source) => DATA_SOURCE_SHORT_LABELS[source]),
    metric: insight.metricLabel,
    value:
      insight.currentValue === null || insight.currentValue === undefined
        ? EMPTY_VALUE
        : renderValue(insight.currentValue, insight.metricLabel.toLowerCase().includes('rate') ? 'percentage' : 'score'),
    comparison: insight.affectedScope,
    strength: insight.signalStrength,
  }

  const seen = new Set<string>()
  const supporting = drivers.flatMap((driver) =>
    driver.evidence.flatMap<TrailNode>((item) => {
      const id = `${driver.category}-${item.label}`
      if (seen.has(item.label)) return []
      seen.add(item.label)
      return [
        {
          id,
          stage: DRIVER_LABELS[driver.category],
          isDetected: false,
          sources: item.source ? [DATA_SOURCE_SHORT_LABELS[item.source]] : [],
          metric: item.label,
          value: renderValue(item.value, item.format),
          comparison:
            item.comparison === undefined
              ? null
              : `vs ${renderValue(item.comparison, item.format)}${item.comparisonLabel ? ` · ${item.comparisonLabel}` : ''}`,
          strength: driver.evidenceStrength,
        },
      ]
    }),
  )

  return [detected, ...supporting]
}

const STAR_SLOTS = Array.from({ length: EVIDENCE_STAR_MAX }, (_, index) => index)

function StrengthStars({ strength }: { strength: TrailNode['strength'] }) {
  const { stars, label } = EVIDENCE_STRENGTH_RATING[strength]

  return (
    <span className="inline-flex items-center gap-1.5" title={`${label} evidence`}>
      <span className="inline-flex" role="img" aria-label={`${label} evidence`}>
        {STAR_SLOTS.map((slot) => (
          <Star
            key={slot}
            className={cn(
              'size-3',
              slot < stars
                ? 'fill-foreground text-foreground'
                : 'fill-muted-foreground/10 text-muted-foreground/30',
            )}
            aria-hidden="true"
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  )
}

const markerClass = (node: TrailNode): string => {
  if (node.isDetected) return 'border-foreground bg-foreground'
  if (node.strength === 'strong') return 'border-foreground/80 bg-foreground/80'
  if (node.strength === 'moderate') return 'border-foreground/50 bg-foreground/40'
  return 'border-muted-foreground/50 bg-card'
}

export function EvidenceTrail({ insight, drivers }: EvidenceTrailProps) {
  const trail = buildTrail(insight, drivers)
  const conclusion = drivers.map((driver) => driver.label)
  const sourceCount = new Set(trail.flatMap((node) => node.sources)).size

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Trail</CardTitle>
        <CardDescription>Supporting evidence, in review order.</CardDescription>
        <CardAction>
          <p className="text-xs text-muted-foreground tabular-nums">
            {trail.length} {trail.length === 1 ? 'item' : 'items'} · {sourceCount}{' '}
            {sourceCount === 1 ? 'source' : 'sources'}
          </p>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ol className="ml-1.5 space-y-1 border-l border-border/70">
          {trail.map((node) => (
            <li key={node.id} className="relative pl-5">
              <span
                aria-hidden="true"
                className={cn('absolute top-3.5 -left-[5px] size-2.5 rounded-full border ring-4 ring-card', markerClass(node))}
              />
              <div className="grid gap-x-6 gap-y-1 rounded-md px-2 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {node.stage}
                  </p>
                  <p className="text-[15px] font-medium break-words">{node.metric}</p>
                  {node.sources.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{node.sources.join(' · ')}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-0.5 tabular-nums sm:items-end sm:text-right">
                  <p className="text-base font-semibold">{node.value}</p>
                  {node.comparison ? (
                    <p className="text-xs text-muted-foreground">{node.comparison}</p>
                  ) : null}
                  <StrengthStars strength={node.strength} />
                </div>
              </div>
            </li>
          ))}

          {conclusion.length > 0 ? (
            <li className="relative pl-5">
              <span
                aria-hidden="true"
                className="absolute top-3.5 -left-[5px] size-2.5 rounded-full border border-dashed border-muted-foreground/60 bg-card ring-4 ring-card"
              />
              <div className="px-2 py-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reported as likely drivers
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {conclusion.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </li>
          ) : null}
        </ol>
      </CardContent>
    </Card>
  )
}
