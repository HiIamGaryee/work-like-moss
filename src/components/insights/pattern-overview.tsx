import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import { SupportingEvidence } from '@/components/insights/supporting-evidence'
import { SuggestedPriorities } from '@/components/insights/suggested-priorities'
import type {
  DivisionAnalysis,
  EmployeeGroupAnalysis,
  HrAnalysis,
  PulseWaveAnalysis,
} from '@/types/hr-analytics'
import {
  EMPTY_VALUE,
  formatCount,
  formatDelta,
  formatPercentage,
  formatScoreOutOf,
} from '@/utils/format'

type ComparisonRow = DivisionAnalysis | EmployeeGroupAnalysis

const COMPARISON_COLUMNS = [
  'Employees',
  'Latest Engagement',
  'vs Company',
  'Leaver Rate',
  'Responses',
] as const

const SCORE_TICKS = Array.from(
  { length: SCORE_SCALE.max - SCORE_SCALE.min + 1 },
  (_, index) => SCORE_SCALE.min + index,
)

function ComparisonCard({
  title,
  label,
  rows,
}: {
  title: string
  label: string
  rows: readonly ComparisonRow[]
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Latest pulse engagement is separate from base engagement. Leaver Rate is the share of
          employees in the dataset marked as leavers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {label.toLowerCase()} records available.</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{label}</TableHead>
                  {COMPARISON_COLUMNS.map((column) => (
                    <TableHead key={column} className="text-right">{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={'division' in row ? row.division : row.group}>
                    <TableCell className="font-medium">
                      {'division' in row ? row.division : row.group}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(row.employeeCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatScoreOutOf(row.latestPulseEngagement, SCORE_SCALE.max)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDelta(row.engagementDifferenceFromCompany)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercentage(row.leaverRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span>n = {formatCount(row.latestPulseResponseCount)}</span>
                      {row.isSmallSample ? (
                        <span className="ml-2 text-xs text-muted-foreground">Small sample</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PulseTrendCard({ pulse }: { pulse: HrAnalysis['pulse'] }) {
  const summary = [
    { key: 'wave', label: 'Latest pulse', value: pulse.latestWave?.wave ?? EMPTY_VALUE },
    {
      key: 'latest',
      label: 'Latest score',
      value: formatScoreOutOf(pulse.latestWave?.averageEngagement ?? null, SCORE_SCALE.max),
    },
    {
      key: 'previous',
      label: 'Previous score',
      value: formatScoreOutOf(pulse.previousWave?.averageEngagement ?? null, SCORE_SCALE.max),
    },
    {
      key: 'previous-responses',
      label: 'Previous responses',
      value: pulse.previousWave
        ? `n = ${formatCount(pulse.previousWave.responseCount)}`
        : EMPTY_VALUE,
    },
    { key: 'change', label: 'Change', value: formatDelta(pulse.latestChange) },
    {
      key: 'direction',
      label: 'Trend direction',
      value: pulse.trendDirection ?? EMPTY_VALUE,
    },
    {
      key: 'responses',
      label: 'Latest responses',
      value: pulse.latestWave ? `n = ${formatCount(pulse.latestWave.responseCount)}` : EMPTY_VALUE,
    },
  ] as const

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Pulse Trend</CardTitle>
        <CardDescription>
          Average engagement by survey wave. Each score uses valid responses only; historical
          participation is unavailable without an eligibility denominator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {summary.map((item) => (
            <div key={item.key} className="space-y-1">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
        {pulse.waves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pulse waves available.</p>
        ) : (
          <div className="h-64 w-full min-w-0" role="img" aria-label="Pulse engagement trend by dated survey wave">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pulse.waves} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="wave" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                <YAxis
                  domain={[SCORE_SCALE.min, SCORE_SCALE.max]}
                  ticks={SCORE_TICKS}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const wave = payload[0]?.payload as PulseWaveAnalysis | undefined
                    if (!wave) return null
                    return (
                      <div className="rounded-md border bg-background p-3 text-sm shadow-sm">
                        <p className="font-medium">{wave.wave}</p>
                        <p>Engagement: {formatScoreOutOf(wave.averageEngagement, SCORE_SCALE.max)}</p>
                        <p>Responses: n = {formatCount(wave.responseCount)}</p>
                        <p>Unique respondents: {formatCount(wave.uniqueRespondentCount)}</p>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="averageEngagement"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="overflow-x-auto text-xs text-muted-foreground">
          <div className="flex min-w-max gap-4">
            {pulse.waves.map((wave) => (
              <span key={wave.wave}>
                {wave.wave}: {formatScoreOutOf(wave.averageEngagement, SCORE_SCALE.max)} · n = {wave.responseCount}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PatternOverview({ analysis }: { analysis: HrAnalysis }) {
  const [selectedPatternId, setSelectedPatternId] = useState('')
  const evidenceChoices = analysis.patterns.signals.flatMap((signal) => {
    const evidence = analysis.evidence.patternEvidenceById[signal.id]
    return evidence ? [{ id: signal.id, signal, evidence }] : []
  })
  const selected = evidenceChoices.find((choice) => choice.id === selectedPatternId)
    ?? evidenceChoices[0] ?? null

  return (
    <section className="space-y-6" aria-labelledby="pattern-overview-title">
      <div className="space-y-1">
        <h2 id="pattern-overview-title" className="text-xl font-semibold tracking-tight">Pattern Overview</h2>
        <p className="text-sm text-muted-foreground">
          Descriptive comparisons from the official dataset. Small samples are labelled; no
          statistical significance is claimed.
        </p>
      </div>
      <ComparisonCard
        title="Division Comparison"
        label="Division"
        rows={analysis.divisions}
      />
      <ComparisonCard
        title="Employee Group Comparison"
        label="Employee Group"
        rows={analysis.employeeGroups}
      />
      <PulseTrendCard pulse={analysis.pulse} />
      {analysis.patterns.signals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Observed Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {analysis.patterns.signals.map((signal) => (
                <li key={signal.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  {signal.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {selected ? (
        <div className="space-y-4">
          <label className="block max-w-sm space-y-1 text-sm font-medium">
            <span>Inspect observed pattern</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={selected.id}
              onChange={(event) => setSelectedPatternId(event.target.value)}
            >
              {evidenceChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.evidence.scope === 'division' ? 'Division' : 'Employee Group'}: {choice.evidence.group}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{selected.signal.message}</p>
          <SupportingEvidence evidence={selected.evidence} />
        </div>
      ) : null}
      <SuggestedPriorities issues={analysis.priorities} />
    </section>
  )
}
import { useState } from 'react'
