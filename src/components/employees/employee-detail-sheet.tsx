import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getEmployeeExitStatus } from '@/data/hr-data.constants'
import { CHANNEL_CONSENT_NOTE } from '@/data/hr-care-demo'
import type { EmployeeCareProfile } from '@/types/hr-automation'
import type { Employee } from '@/types/hr-data'
import {
  EMPTY_VALUE,
  formatDate,
} from '@/utils/format'

export type EmployeeLifecycle = {
  employee: Employee
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

  const { employee, careProfile } = lifecycle

  const officialFields = [
    { key: 'id', label: 'Employee ID', value: employee.employeeId },
    { key: 'division', label: 'Division', value: employee.division },
    { key: 'group', label: 'Employee group', value: employee.employeeGroup },
    { key: 'location', label: 'Location', value: employee.location },
    { key: 'join', label: 'Join date', value: formatDate(employee.joinDate) },
    { key: 'tenure', label: 'Tenure', value: employee.tenureMonths === null ? EMPTY_VALUE : `${employee.tenureMonths} months` },
    { key: 'status', label: 'Status', value: getEmployeeExitStatus(employee.exitStatus) ?? employee.exitStatus },
    ...(employee.exitDate ? [{ key: 'exitDate', label: 'Exit date', value: formatDate(employee.exitDate) }] : []),
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
            Read-only operational record from the official Employees sheet. Individual survey analytics are protected.
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

          <section className="space-y-2 rounded-lg border border-dashed p-3">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Survey privacy
            </h3>
            <p className="text-sm text-muted-foreground">
              Individual survey scores, responses, comments, and inferred experience signals are
              not displayed here. Group-level analytics are available in Insights.
            </p>
          </section>

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
