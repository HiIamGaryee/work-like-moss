import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { CHART_GRID_COLOR, CHART_SERIES_COLOR } from '@/data/dashboard.constants'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type { HrAnalytics } from '@/types/hr-analytics'
import { canShowGroupDetail } from '@/utils/insight-privacy'

type Row = { label: string; value: number }

const CONFIG = { value: { label: 'Value', color: CHART_SERIES_COLOR } } satisfies ChartConfig

function BarCard({
  title,
  description,
  rows,
  max,
  unit,
}: {
  title: string
  description: string
  rows: Row[]
  max?: number
  unit: string
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough responses to display.</p>
        ) : (
          <ChartContainer config={CONFIG} className="aspect-auto h-[240px] w-full">
            <BarChart accessibilityLayer data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <title>{title}</title>
              <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} className="text-xs" />
              <YAxis domain={[0, max ?? 'auto']} tickLine={false} axisLine={false} width={40} className="text-xs" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(value) => <span className="tabular-nums">{`${value}${unit}`}</span>}
                  />
                }
              />
              <Bar dataKey="value" fill={CHART_SERIES_COLOR} radius={4} maxBarSize={44} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const round = (value: number): number => Math.round(value * 100) / 100

export function CeoCharts({ analytics }: { analytics: HrAnalytics }) {
  const { employees, onboarding, divisions } = analytics

  const leaverByDivision = employees.byDivision
    .filter((d) => d.leaverRate !== null && canShowGroupDetail(d.employeeCount))
    .map((d) => ({ label: d.division, value: round(d.leaverRate ?? 0) }))
    .sort((a, b) => b.value - a.value)

  const pulseByDivision = divisions
    .filter((d) => d.pulse?.latest?.engagement != null && canShowGroupDetail(d.pulse.latest.responseCount))
    .map((d) => ({ label: d.division, value: round(d.pulse?.latest?.engagement ?? 0) }))
    .sort((a, b) => b.value - a.value)

  const leaverByTenure = employees.byTenureBand
    .filter((t) => t.leaverRate !== null && canShowGroupDetail(t.employeeCount))
    .map((t) => ({ label: t.band, value: round(t.leaverRate ?? 0) }))

  const onboardingScores = canShowGroupDetail(onboarding.responseCount)
    ? onboarding.dimensions
        .filter((d) => d.score !== null)
        .map((d) => ({ label: d.label, value: round(d.score ?? 0) }))
    : []

  return (
    <section className="space-y-4" aria-labelledby="ceo-charts-title">
      <div className="space-y-1">
        <h2 id="ceo-charts-title" className="text-lg font-semibold tracking-tight">Executive Charts</h2>
        <p className="text-sm text-muted-foreground">Where to look first, at a glance.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarCard title="Leaver Rate by Division" description="Share of employees marked as leavers, highest first." rows={leaverByDivision} unit="%" />
        <BarCard title="Latest Engagement by Division" description={`Latest pulse score out of ${SCORE_SCALE.max}.`} rows={pulseByDivision} max={SCORE_SCALE.max} unit={` / ${SCORE_SCALE.max}`} />
        <BarCard title="Leaver Rate by Tenure" description="Which stage of tenure loses the most people." rows={leaverByTenure} unit="%" />
        <BarCard title="Onboarding Scores" description={`New joiner experience out of ${SCORE_SCALE.max}.`} rows={onboardingScores} max={SCORE_SCALE.max} unit={` / ${SCORE_SCALE.max}`} />
      </div>
    </section>
  )
}
