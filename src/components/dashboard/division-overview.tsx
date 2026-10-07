import { Building2 } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { InfoHint } from '@/components/dashboard/info-hint'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { METRIC_HINTS } from '@/data/dashboard.constants'
import type { DivisionAnalytics } from '@/types/hr-analytics'
import { formatCount, formatPercentage, formatRatioAsPercentage, formatScore } from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

type DivisionOverviewProps = {
  divisions: DivisionAnalytics[]
}

const COLUMNS = [
  { key: 'division', label: 'Division', align: 'left' },
  { key: 'employees', label: 'Employees', align: 'right' },
  { key: 'leavers', label: 'Leavers', align: 'right' },
  { key: 'leaverRate', label: 'Leaver Rate', align: 'right', hint: METRIC_HINTS.leaverRate },
  {
    key: 'baseEngagement',
    label: 'Base Engagement',
    align: 'right',
    hint: METRIC_HINTS.baseEngagement,
  },
  {
    key: 'latestPulse',
    label: 'Latest Pulse',
    align: 'right',
    hint: METRIC_HINTS.divisionPulse,
  },
] as const

export function DivisionOverview({ divisions }: DivisionOverviewProps) {
  /**
   * Ordering only — every value below is already calculated by the analytics
   * layer. Highest leaver rate first is a factual sort, not a priority score.
   */
  const divisionRows = [...divisions].sort((a, b) => {
    const aVisible = canShowGroupDetail(a.pulse?.latest?.responseCount)
    const bVisible = canShowGroupDetail(b.pulse?.latest?.responseCount)
    if (aVisible !== bVisible) return Number(bVisible) - Number(aVisible)
    if (!aVisible || !bVisible) return a.division.localeCompare(b.division)
    return (b.employees.leaverRate ?? -Infinity) - (a.employees.leaverRate ?? -Infinity)
  }).map(
    (entry) => ({
      division: entry.division,
      canShow: canShowGroupDetail(entry.pulse?.latest?.responseCount),
      employees: formatCount(entry.employees.employeeCount),
      leavers: formatCount(entry.employees.leaverCount),
      leaverRate: formatPercentage(entry.employees.leaverRate),
      baseEngagement: formatRatioAsPercentage(entry.employees.averageBaseEngagement),
      latestPulse: formatScore(entry.pulse?.latest?.engagement ?? null),
    }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Division Overview</CardTitle>
        <CardDescription>
          Compare workforce health across divisions, sorted by highest leaver rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {divisionRows.length === 0 ? (
          <div className="px-(--card-spacing)">
            <EmptyState icon={Building2} title="No division data available." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    scope="col"
                    className={`text-xs font-medium text-muted-foreground ${
                      column.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${
                        column.align === 'right' ? 'justify-end' : ''
                      }`}
                    >
                      {column.label}
                      {'hint' in column ? (
                        <InfoHint label={column.label} hint={column.hint} />
                      ) : null}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisionRows.map((row) => (
                <TableRow key={row.division}>
                  <TableCell className="font-medium">{row.division}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.employees}</TableCell>
                  {row.canShow ? <>
                    <TableCell className="text-right tabular-nums">{row.leavers}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.leaverRate}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{row.baseEngagement}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.latestPulse}</TableCell>
                  </> : <TableCell colSpan={4} className="text-right text-sm text-muted-foreground">{PRIVACY_SUPPRESSED_MESSAGE}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
