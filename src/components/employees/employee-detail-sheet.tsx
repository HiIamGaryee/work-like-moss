import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import { getEmployeeExitStatus } from '@/data/hr-data.constants'
import { CHANNEL_CONSENT_NOTE } from '@/data/hr-care-demo'
import type { EmployeeCareProfile } from '@/types/hr-automation'
import type { Employee, ExitSurvey, OnboardingSurvey, PulseSurvey } from '@/types/hr-data'
import {
  EMPTY_VALUE,
  formatDate,
  formatScore,
  formatRatioAsPercentage,
  formatScoreOutOf,
} from '@/utils/format'

export type EmployeeLifecycle = {
  employee: Employee
  onboarding: OnboardingSurvey[]
  pulse: PulseSurvey[]
  exit: ExitSurvey | null
  /** Present only when Step 9 demo care data covers this employee. */
  careProfile: EmployeeCareProfile | null
}

type EmployeeDetailSheetProps = {
  lifecycle: EmployeeLifecycle | null
  onClose: () => void
}

/**
 * One employee's own record, read-only.
 *
 * Everything above the separator is a field the official workbook actually
 * stores. Nothing here scores the person: no retention risk, no loyalty index,
 * no commitment rating — this product analyses groups and surfaces care moments,
 * and an individual profile is exactly where that boundary matters most.
 *
 * Where Step 9 demo care data covers the employee, it appears in its own clearly
 * labelled section so a synthetic birthday is never read as official data.
 */
export function EmployeeDetailSheet({ lifecycle, onClose }: EmployeeDetailSheetProps) {
  if (!lifecycle) return null

  const { employee, onboarding, pulse, exit, careProfile } = lifecycle

  const officialFields = [
    { key: 'id', label: 'Employee ID', value: employee.employeeId },
    { key: 'division', label: 'Division', value: employee.division },
    { key: 'group', label: 'Employee group', value: employee.employeeGroup },
    { key: 'location', label: 'Location', value: employee.location },
    { key: 'join', label: 'Join date', value: formatDate(employee.joinDate) },
    { key: 'tenure', label: 'Tenure', value: employee.tenureMonths === null ? EMPTY_VALUE : `${employee.tenureMonths} months` },
    { key: 'status', label: 'Status', value: getEmployeeExitStatus(employee.exitStatus) ?? employee.exitStatus },
    {
      key: 'engagement',
      label: 'Base engagement',
      value: formatRatioAsPercentage(employee.baseEngagement),
    },
    ...(employee.exitDate ? [{ key: 'exitDate', label: 'Exit date', value: formatDate(employee.exitDate) }] : []),
    ...(employee.exitReason
      ? [{ key: 'exitReason', label: 'Exit reason', value: employee.exitReason }]
      : []),
  ]

  return (
    <Sheet open onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        aria-describedby="employee-detail-description"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>{employee.employeeId}</SheetTitle>
          <SheetDescription id="employee-detail-description">
            Read-only record from the official Employees sheet and its linked survey responses.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Official record
              </h3>
              <Badge variant="outline">Official Dataset</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {officialFields.map((field) => (
                <div key={field.key} className="min-w-0 space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="text-sm font-medium break-words tabular-nums">{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Onboarding responses
            </h3>
            {onboarding.length === 0 ? (
              <p className="text-sm text-muted-foreground">No onboarding responses on record.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Date</TableHead>
                    <TableHead scope="col">Overall</TableHead>
                    <TableHead scope="col">Manager</TableHead>
                    <TableHead scope="col">Role clarity</TableHead>
                    <TableHead scope="col">Tools</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboarding.map((row) => (
                    <TableRow key={`${row.employeeId}-${row.surveyDate}`}>
                      <TableCell className="tabular-nums">{formatDate(row.surveyDate)}</TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.overallScore, 1)}</TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.managerSupport, 1)}</TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.roleClarity, 1)}</TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.toolsAccess, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Pulse survey waves
            </h3>
            {pulse.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pulse responses on record.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Wave</TableHead>
                    <TableHead scope="col">Engagement</TableHead>
                    <TableHead scope="col">Manager</TableHead>
                    <TableHead scope="col">Workload</TableHead>
                    <TableHead scope="col">Career</TableHead>
                    <TableHead scope="col">Belonging</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pulse.map((row) => (
                    <TableRow key={`${row.employeeId}-${row.surveyWave}`}>
                      <TableCell className="whitespace-nowrap">{row.surveyWave}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatScore(row.engagementScore, 1)}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.managerSupport, 1)}</TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.workload, 1)}</TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.careerGrowth, 1)}</TableCell>
                      <TableCell className="tabular-nums">{formatScore(row.belonging, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {exit ? (
            <section className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Exit survey
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[
                  { key: 'reason', label: 'Primary reason', value: exit.primaryExitReason },
                  {
                    key: 'overall',
                    label: 'Overall experience',
                    value: formatScoreOutOf(exit.overallExperience, SCORE_SCALE.max),
                  },
                  {
                    key: 'manager',
                    label: 'Manager support',
                    value: formatScoreOutOf(exit.managerSupport, SCORE_SCALE.max),
                  },
                  {
                    key: 'career',
                    label: 'Career opportunity',
                    value: formatScoreOutOf(exit.careerOpportunity, SCORE_SCALE.max),
                  },
                  { key: 'recommend', label: 'Would recommend', value: exit.wouldRecommend },
                ].map((field) => (
                  <div key={field.key} className="min-w-0 space-y-0.5">
                    <dt className="text-xs text-muted-foreground">{field.label}</dt>
                    <dd className="text-sm font-medium break-words tabular-nums">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {careProfile ? (
            <>
              <Separator />
              <section className="space-y-2 rounded-lg border border-dashed p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Care records
                  </h3>
                  <Badge variant="secondary">Demo Care Extension</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Synthetic demonstration data, not part of the official workbook. The official
                  dataset carries no employee names or care history.
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { key: 'name', label: 'Display name', value: careProfile.displayName },
                    {
                      key: 'birthday',
                      label: 'Birthday',
                      value:
                        careProfile.birthdayMonth && careProfile.birthdayDay
                          ? `${careProfile.birthdayDay}/${careProfile.birthdayMonth}`
                          : EMPTY_VALUE,
                    },
                    {
                      key: 'checkin',
                      label: 'Last manager check-in',
                      value: formatDate(careProfile.lastManagerCheckinDate ?? null),
                    },
                    {
                      key: 'review',
                      label: 'Last compensation review',
                      value: formatDate(careProfile.lastCompensationReviewDate ?? null),
                    },
                    {
                      key: 'recognition',
                      label: 'Last recognition',
                      value: formatDate(careProfile.lastRecognitionDate ?? null),
                    },
                  ].map((field) => (
                    <div key={field.key} className="min-w-0 space-y-0.5">
                      <dt className="text-xs text-muted-foreground">{field.label}</dt>
                      <dd className="text-sm font-medium break-words tabular-nums">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">{CHANNEL_CONSENT_NOTE}</p>
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
