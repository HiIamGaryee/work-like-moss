import { Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DatasetError } from '@/components/dataset-status'
import {
  EmployeeDetailSheet,
  type EmployeeLifecycle,
} from '@/components/employees/employee-detail-sheet'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { demoCareProfiles } from '@/data/hr-care-demo'
import { getEmployeeExitStatus } from '@/data/hr-data.constants'
import { useDemoRole } from '@/hooks/use-demo-role'
import { useHrData } from '@/hooks/use-hr-data'
import { getRoleDivision } from '@/lib/demo-role-config'
import { getAvailableDivisions } from '@/lib/divisions'
import type { Employee } from '@/types/hr-data'
import { formatCount } from '@/utils/format'

/** How many rows render at once; the filters narrow the list rather than paging. */
const ROW_LIMIT = 50

const ALL = 'all'

const COLUMNS = [
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'division', label: 'Division' },
  { key: 'employeeGroup', label: 'Employee Group' },
  { key: 'location', label: 'Location' },
  { key: 'tenure', label: 'Tenure' },
  { key: 'status', label: 'Status' },
] as const

const STATUS_OPTIONS = [
  { key: ALL, label: 'All statuses' },
  { key: 'Active', label: 'Active' },
  { key: 'Leaver', label: 'Leaver' },
] as const

const distinct = (values: readonly string[]): string[] => [...new Set(values)].sort()

/**
 * A read-only directory over the official Employees sheet.
 *
 * Deliberately plain: this is not an HRIS, and it does not profile anyone. Every
 * column is a field the workbook stores, there is no risk, loyalty or commitment
 * score anywhere, and the detail panel keeps Step 9's synthetic care data in a
 * separately labelled section.
 */
export function EmployeesPage() {
  const { role, division: sessionDivision } = useDemoRole()
  const managerDivision = getRoleDivision(role, sessionDivision)
  const { data, isLoading, error, retry } = useHrData()

  const [search, setSearch] = useState('')
  const [division, setDivision] = useState<string>(ALL)
  const [group, setGroup] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [selected, setSelected] = useState<EmployeeLifecycle | null>(null)

  /* Memoised so the `[]` fallback does not re-run every filter on each render. */
  const employees = useMemo(() => data?.employees ?? [], [data])

  const divisions = useMemo(() => getAvailableDivisions(data), [data])
  const groups = useMemo(() => distinct(employees.map((e) => e.employeeGroup)), [employees])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return employees.filter((employee) => {
      if (division !== ALL && employee.division !== division) return false
      if (group !== ALL && employee.employeeGroup !== group) return false
      if (status !== ALL && getEmployeeExitStatus(employee.exitStatus) !== status) return false
      if (query === '') return true

      /* Search covers only the identifying fields the directory displays. */
      return [
        employee.employeeId,
        employee.division,
        employee.employeeGroup,
        employee.location,
      ].some((field) => field.toLowerCase().includes(query))
    })
  }, [employees, search, division, group, status])

  const openDetail = (employee: Employee): void => {
    if (!data) return
    setSelected({
      employee,
      careProfile:
        demoCareProfiles.find((profile) => profile.employeeId === employee.employeeId) ?? null,
    })
  }

  const filters = [
    { key: 'group', label: 'Employee group', value: group, set: setGroup, options: groups },
  ]

  return (
    <div className="w-full space-y-8">
      <section className="border-b pb-6">
        <PageHeader
          title="Employees"
          description="Read-only operational directory of the official employee records behind workforce signals."
          actions={<Badge variant="outline">Official Dataset</Badge>}
        />
      </section>

      {error ? <DatasetError message={error} onRetry={retry} /> : null}

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data && !error ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              Directory · {formatCount(filtered.length)} of {formatCount(employees.length)}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="employee-search">Search</Label>
                <Input
                  id="employee-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ID, division, group or location"
                />
              </div>

              {managerDivision ? (
                <div className="space-y-1.5">
                  <Label>Division</Label>
                  <div className="flex h-8 items-center rounded-lg border bg-muted/30 px-2.5 text-sm font-medium">
                    {managerDivision}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="employee-division">Division</Label>
                  <Select value={division} onValueChange={setDivision}>
                    <SelectTrigger id="employee-division" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All divisions</SelectItem>
                      {divisions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.map((filter) => (
                <div key={filter.key} className="space-y-1.5">
                  <Label htmlFor={`employee-${filter.key}`}>{filter.label}</Label>
                  <Select value={filter.value} onValueChange={filter.set}>
                    <SelectTrigger id={`employee-${filter.key}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All {filter.label.toLowerCase()}s</SelectItem>
                      {filter.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="employee-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="employee-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No employees match these filters."
                description="Clear the search or widen a filter to see records again."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {COLUMNS.map((column) => (
                        <TableHead key={column.key} scope="col">
                          {column.label}
                        </TableHead>
                      ))}
                      <TableHead scope="col">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, ROW_LIMIT).map((employee) => (
                      <TableRow key={employee.employeeId}>
                        <TableCell className="font-medium">{employee.employeeId}</TableCell>
                        <TableCell>{employee.division}</TableCell>
                        <TableCell>{employee.employeeGroup}</TableCell>
                        <TableCell>{employee.location}</TableCell>
                        <TableCell className="tabular-nums">
                          {employee.tenureMonths === null ? '—' : `${employee.tenureMonths} months`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={employee.exitStatus === 'Active' ? 'secondary' : 'outline'}
                          >
                            {getEmployeeExitStatus(employee.exitStatus) ?? employee.exitStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openDetail(employee)}
                            aria-label={`View record for ${employee.employeeId}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {filtered.length > ROW_LIMIT ? (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {formatCount(ROW_LIMIT)} of {formatCount(filtered.length)}{' '}
                    matching records. Narrow the search or filters to see the rest.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <EmployeeDetailSheet lifecycle={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
