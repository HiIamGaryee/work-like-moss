import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ActionRecord, ActionStatus } from '@/types/hr-data'
import { formatDate } from '@/utils/format'

type ExistingActionsTableProps = {
  actions: ActionRecord[]
}

/** Monochrome only — the official status word carries the meaning. */
const STATUS_VARIANTS: Record<ActionStatus, 'default' | 'secondary' | 'outline'> = {
  Completed: 'default',
  'In Progress': 'secondary',
  Planned: 'outline',
}

const COLUMNS = [
  { key: 'action', label: 'Action' },
  { key: 'scope', label: 'Scope' },
  { key: 'theme', label: 'Theme' },
  { key: 'owner', label: 'Owner' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'status', label: 'Status' },
  { key: 'successMeasure', label: 'Success Measure' },
] as const

/**
 * The official `Action_Tracker` sheet, rendered exactly as the workbook records
 * it. These rows are read-only by design: statuses keep their source wording and
 * nothing on this page can edit, restyle or reset them.
 */
export function ExistingActionsTable({ actions }: ExistingActionsTableProps) {
  if (actions.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No actions recorded in the official dataset."
        description="The workbook's Action_Tracker sheet contains no rows."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column.key}>{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.map((record) => (
          <TableRow key={record.actionId}>
            <TableCell className="max-w-[18rem] whitespace-normal font-medium">
              {record.action}
            </TableCell>
            <TableCell>{record.scope}</TableCell>
            <TableCell>{record.theme}</TableCell>
            <TableCell>{record.owner}</TableCell>
            <TableCell className="tabular-nums">{formatDate(record.startDate)}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[record.status]}>{record.status}</Badge>
            </TableCell>
            <TableCell className="max-w-[20rem] whitespace-normal text-muted-foreground">
              {record.successMeasure}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
