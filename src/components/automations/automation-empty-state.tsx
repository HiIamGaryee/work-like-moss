import { BellOff } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

/**
 * A quiet inbox is a real result, not a gap to fill. Nothing here invents an
 * urgent event so the page looks busier than the data warrants.
 */
export function AutomationEmptyState({ filtered = false }: { filtered?: boolean }) {
  return filtered ? (
    <EmptyState
      icon={BellOff}
      title="No reminders match this filter."
      description="Other tabs or categories may still have reminders waiting."
    />
  ) : (
    <EmptyState
      icon={BellOff}
      title="Nothing needs attention right now."
      description="Upcoming employee-care and action reminders will appear here automatically."
    />
  )
}
