import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHrActions } from '@/hooks/use-hr-actions'
import { clearAutomationState } from '@/services/hr-automation-storage.service'

/**
 * Pitch-recording convenience, kept deliberately thin.
 *
 * Two things only: jump to whatever the highest-priority insight currently is,
 * and put local demo state back to zero. There is no way to fabricate a result
 * from here — no simulated survey wave, no injected measurement — because a demo
 * that can invent its own success proves nothing.
 *
 * Reset clears local operational state only. The official workbook is read from
 * disk on every load and is never written.
 */
export function DemoMenu() {
  const navigate = useNavigate()
  const { topPriorityItems, resetDemo } = useHrActions()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const topInsight = topPriorityItems[0] ?? null

  const goToTopInsight = (): void => {
    if (!topInsight) {
      toast.info('No insight is currently detected.')
      return
    }
    /* Calculated from live priority, never a hardcoded id. */
    navigate(`/insights/${topInsight.insight.id}`)
  }

  const resetFullDemo = (): void => {
    resetDemo()
    clearAutomationState()
    toast.success('Demo reset', {
      description: 'Local actions and handled reminders cleared. Official data is unchanged.',
    })
    /* A full reload re-mounts every hook so no stale local state survives. */
    window.location.assign('/')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Demo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Presentation helpers</DropdownMenuLabel>
          <DropdownMenuItem onSelect={goToTopInsight} disabled={!topInsight}>
            Go to top insight
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>Reset full demo</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset full demo?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears locally approved and rejected recommendations and every handled reminder.
              The official Excel dataset, its analytics and its Action Tracker are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetFullDemo}>Reset full demo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
