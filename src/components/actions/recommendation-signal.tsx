import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { Line, LineChart, YAxis } from 'recharts'
import { InfoHint } from '@/components/dashboard/info-hint'
import { PriorityBadge } from '@/components/insights/priority-badge'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { CHART_SERIES_COLOR } from '@/data/dashboard.constants'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { PriorityLevel } from '@/types/hr-intelligence'
import { formatPercentage, formatScoreOutOf } from '@/utils/format'
import type { RecommendationSignal, SignalUnit, TrendDirection } from '@/utils/hr-recommendation-view'

const PRIORITY_HINT =
  'Weighted blend of severity, reach, evidence and urgency. It ranks issues for review; it is not a prediction.'
const BENCHMARK_HINT = 'The comparison figure this score is measured against.'
const SMALL_SAMPLE_HINT = 'Treat as an investigation signal rather than a firm conclusion.'

const formatValue = (unit: SignalUnit, value: number): string =>
  unit === 'percentage' ? formatPercentage(value) : formatScoreOutOf(value, SCORE_SCALE.max)

function ValueBar({ label, value, width, muted = false }: {
  label: string
  value: string
  width: number
  muted?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate capitalize text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${muted ? 'bg-foreground/35' : 'bg-foreground'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

/** Scope value against its benchmark: the one primary visual on the card. */
export function MetricComparison({ signal }: { signal: RecommendationSignal }) {
  const { unit, observed, benchmark } = signal
  const max = unit === 'score' ? SCORE_SCALE.max : Math.max(observed, benchmark ?? 0) || 1
  const width = (value: number): number => Math.max(0, Math.min(100, (value / max) * 100))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatValue(unit, observed)}
        </span>
        {signal.gapText ? (
          <span className="text-sm font-medium tabular-nums">{signal.gapText}</span>
        ) : null}
        <span className="text-xs text-muted-foreground tabular-nums">n = {signal.sampleSize}</span>
        {signal.isSmallSample ? (
          <span className="inline-flex items-center gap-1">
            <Badge variant="outline">Small sample</Badge>
            <InfoHint label="small sample" hint={SMALL_SAMPLE_HINT} />
          </span>
        ) : null}
      </div>

      {benchmark !== null ? (
        <div className="space-y-2">
          <ValueBar label={signal.scopeName} value={formatValue(unit, observed)} width={width(observed)} />
          <ValueBar label={signal.benchmarkLabel} value={formatValue(unit, benchmark)} width={width(benchmark)} muted />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Benchmark: {signal.benchmarkLabel}
            <InfoHint label="benchmark" hint={BENCHMARK_HINT} />
          </p>
        </div>
      ) : null}
    </div>
  )
}

const TREND_ICONS: Record<TrendDirection, ComponentType<{ className?: string }>> = {
  improving: ArrowUpRight,
  declining: ArrowDownRight,
  stable: Minus,
}

const TREND_CONFIG = { value: { label: 'Engagement', color: CHART_SERIES_COLOR } } satisfies ChartConfig

/** 2–5 real pulse waves as a sparkline; absent when fewer than two exist. */
export function MiniTrend({ trend }: { trend: NonNullable<RecommendationSignal['trend']> }) {
  const first = trend.points[0]
  const last = trend.points[trend.points.length - 1]
  const Icon = TREND_ICONS[trend.direction]
  if (!first || !last) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Engagement trend</span>
        <span className="inline-flex items-center gap-1 font-medium capitalize">
          <Icon className="size-3.5" aria-hidden="true" />
          {trend.direction}
        </span>
      </div>
      <ChartContainer config={TREND_CONFIG} className="aspect-auto h-12 w-full">
        <LineChart data={trend.points} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <title>Engagement across the latest pulse waves</title>
          <YAxis hide domain={[(min: number) => min - 0.1, (max: number) => max + 0.1]} />
          <Line
            dataKey="value"
            type="monotone"
            stroke={CHART_SERIES_COLOR}
            strokeWidth={2}
            dot={{ r: 2.5, fill: CHART_SERIES_COLOR }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{first.wave} · {first.value.toFixed(2)}</span>
        <span>{last.wave} · {last.value.toFixed(2)}</span>
      </div>
    </div>
  )
}

/** The headline score, its band and (when prepared) the four factor bars. */
export function PriorityPanel({ score, level, factors }: {
  score: number
  level: PriorityLevel
  factors: RecommendationSignal['factors']
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          Priority score
          <InfoHint label="priority score" hint={PRIORITY_HINT} />
        </span>
        <PriorityBadge level={level} />
      </div>
      <div className="space-y-1.5">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {score}
          <span className="text-sm font-normal text-muted-foreground"> / 100</span>
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, score)}%` }} />
        </div>
      </div>
      {factors.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
          {factors.map((factor) => (
            <div key={factor.key} title={factor.reason}>
              <ValueBar label={factor.label} value={String(factor.score)} width={factor.score} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The related driver, visually apart from the issue it may explain. */
export function SupportingSignal({ supporting }: {
  supporting: NonNullable<RecommendationSignal['supporting']>
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Supporting signal</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{supporting.label}</span>
        {supporting.gapText ? (
          <span className="text-sm tabular-nums text-muted-foreground">{supporting.gapText}</span>
        ) : null}
        {supporting.strength ? (
          <Badge variant="outline" className="capitalize">{supporting.strength} evidence</Badge>
        ) : null}
      </div>
    </div>
  )
}
