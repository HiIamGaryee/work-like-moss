import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/empty-state'
import { InfoHint } from '@/components/dashboard/info-hint'
import { LineChart as LineChartIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  CHART_GRID_COLOR,
  CHART_SERIES_COLOR,
  SCORE_AXIS_DOMAIN,
  SCORE_AXIS_TICKS,
} from '@/data/dashboard.constants'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { PulseTrendPoint, ScoreInterpretation } from '@/types/hr-analytics'
import { formatScore, formatScoreOutOf } from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type PulseTrendChartProps = {
  trend: PulseTrendPoint[]
  latest: PulseTrendPoint | null
  workload: ScoreInterpretation
}

/** Human labels only — no internal keys ever reach the tooltip. */
const CHART_CONFIG = {
  engagement: { label: 'Engagement', color: CHART_SERIES_COLOR },
} satisfies ChartConfig

/**
 * The latest wave, broken out beside the trend. Workload carries a hint built
 * from the workbook's own definition so a high score is never read as good.
 */
const SUPPORTING_SCORES = [
  { key: 'managerSupport', label: 'Manager Support' },
  { key: 'workload', label: 'Workload' },
  { key: 'careerGrowth', label: 'Career Growth' },
  { key: 'belonging', label: 'Belonging' },
] as const satisfies readonly { key: keyof PulseTrendPoint; label: string }[]

const WORKLOAD_HINTS: Record<ScoreInterpretation['direction'], string> = {
  higherIsWorse: 'Perceived workload pressure. A higher score means more pressure, not better.',
  higherIsBetter: 'Perceived workload. A higher score is the better outcome.',
  unknown: 'The workbook does not document which direction of this score is better.',
}

export function PulseTrendChart({ trend, latest, workload }: PulseTrendChartProps) {
  const hasData = trend.some((point) => point.responseCount > 0)
  const safeTrend = trend.map((point) =>
    canShowGroupDetail(point.responseCount) ? point : { ...point, engagement: null },
  )
  const latestIsSafe = canShowGroupDetail(latest?.responseCount)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Pulse Engagement</CardTitle>
        <CardDescription>Employee engagement across survey waves.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {hasData ? (
          <ChartContainer
            config={CHART_CONFIG}
            className="aspect-auto h-[220px] w-full sm:h-[260px]"
          >
            <LineChart
              accessibilityLayer
              data={safeTrend}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
            >
              <title>Pulse engagement by survey wave</title>
              <desc>
                Average engagement score on a {SCORE_SCALE.min} to {SCORE_SCALE.max} scale for each
                detected pulse survey wave.
              </desc>
              <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
              <XAxis
                dataKey="wave"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                /* Every wave gets a label; padding keeps the first and last on-canvas. */
                interval={0}
                padding={{ left: 24, right: 24 }}
                className="text-xs"
              />
              <YAxis
                domain={[...SCORE_AXIS_DOMAIN]}
                ticks={SCORE_AXIS_TICKS}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
                className="text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelKey="wave"
                    formatter={(value) => (
                    <span className="tabular-nums">
                      {latestIsSafe ? `Engagement ${formatScoreOutOf(Number(value), SCORE_SCALE.max)}` : PRIVACY_SUPPRESSED_MESSAGE}
                    </span>
                    )}
                  />
                }
              />
              <Line
                dataKey="engagement"
                name="Engagement"
                type="monotone"
                stroke={CHART_SERIES_COLOR}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_SERIES_COLOR }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                animationDuration={400}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <EmptyState icon={LineChartIcon} title="No pulse survey data available." />
        )}

        {latest ? (
          <div className="space-y-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Latest wave · {latest.wave} · {latest.responseCount.toLocaleString()} responses
            </p>
            {latestIsSafe ? <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {SUPPORTING_SCORES.map(({ key, label }) => (
                <div key={key} className="space-y-0.5">
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                    {label}
                    {key === 'workload' ? (
                      <InfoHint
                        label={label}
                        hint={workload.description ?? WORKLOAD_HINTS[workload.direction]}
                      />
                    ) : null}
                  </dt>
                  <dd className="text-base font-medium tabular-nums">
                    {formatScore(latest[key])}
                  </dd>
                </div>
              ))}
            </dl> : <p className="text-sm text-muted-foreground">{PRIVACY_SUPPRESSED_MESSAGE}</p>}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
