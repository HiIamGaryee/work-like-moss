import { ArrowDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import { DRIVER_LABELS } from '@/data/hr-root-cause-rules'
import type { HrInsight, LikelyDriver } from '@/types/hr-insights'
import { EMPTY_VALUE, formatCount, formatDelta, formatPercentage, formatScoreOutOf } from '@/utils/format'

type EvidenceTrailProps = {
  insight: HrInsight
  drivers: LikelyDriver[]
}

type TrailNode = {
  id: string
  stage: string
  source: string
  metric: string
  value: string
  comparison: string | null
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
    source: insight.dataSources.join(' · '),
    metric: insight.metricLabel,
    value:
      insight.currentValue === null || insight.currentValue === undefined
        ? EMPTY_VALUE
        : renderValue(insight.currentValue, insight.metricLabel.toLowerCase().includes('rate') ? 'percentage' : 'score'),
    comparison: insight.affectedScope,
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
          source: item.source ?? '',
          metric: item.label,
          value: renderValue(item.value, item.format),
          comparison:
            item.comparison === undefined
              ? null
              : `vs ${renderValue(item.comparison, item.format)}${item.comparisonLabel ? ` · ${item.comparisonLabel}` : ''}`,
        },
      ]
    }),
  )

  return [detected, ...supporting]
}

export function EvidenceTrail({ insight, drivers }: EvidenceTrailProps) {
  const trail = buildTrail(insight, drivers)
  const conclusion = drivers.map((driver) => driver.label)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Trail</CardTitle>
        <CardDescription>
          Every measure the engine used, in the order it read them.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {trail.map((node, index) => (
          <div key={node.id} className="space-y-2">
            <div className="grid gap-1 rounded-lg border px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-baseline">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{node.stage}</p>
                <p className="text-sm font-medium break-words">{node.metric}</p>
                {node.source ? (
                  <p className="text-xs text-muted-foreground">{node.source}</p>
                ) : null}
              </div>
              <div className="text-left tabular-nums sm:text-right">
                <p className="text-sm font-medium">{node.value}</p>
                {node.comparison ? (
                  <p className="text-xs text-muted-foreground">{node.comparison}</p>
                ) : null}
              </div>
            </div>
            {index < trail.length - 1 ? (
              <ArrowDown className="mx-3 size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : null}
          </div>
        ))}

        {conclusion.length > 0 ? (
          <>
            <ArrowDown className="mx-3 size-3.5 text-muted-foreground" aria-hidden="true" />
            <div className="rounded-lg border border-dashed px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Reported as likely drivers</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {conclusion.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
