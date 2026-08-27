import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ResetDemoMenuProps = {
  /** Menu item wording, e.g. "Reset demo" or "Reset automation demo". */
  label: string
  confirmTitle: string
  confirmDescription: string
  menuAriaLabel: string
  onReset: () => void
}

/**
 * Demo housekeeping, useful when a pitch video is recorded more than once.
 *
 * Shared by the Action Centre and the Automations page so each keeps its own
 * scope: resetting reminders must never delete actions HR approved, and
 * resetting actions is a separate, explicitly-worded confirmation. Every caller
 * supplies its own copy, so the dialog always states exactly what it clears.
 */
export function ResetDemoMenu({
  label,
  confirmTitle,
  confirmDescription,
  menuAriaLabel,
  onReset,
}: ResetDemoMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label={menuAriaLabel}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>{label}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>{label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
