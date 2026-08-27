import { Badge } from '@/components/ui/badge'
import { AUTOMATION_SOURCE_LABELS, AUTOMATION_URGENCY_LABELS } from '@/data/hr-automation-rules'
import type { AutomationSource, AutomationUrgency } from '@/types/hr-automation'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'

/**
 * Monochrome by weight, never by hue. Every automation type would otherwise
 * want its own colour, and the page would stop reading as one product — so
 * urgency is carried by the word and the badge weight, and the type is carried
 * by its icon and label on the card.
 */
const URGENCY_VARIANTS: Record<AutomationUrgency, BadgeVariant> = {
  overdue: 'destructive',
  today: 'default',
  upcoming: 'secondary',
  attention: 'outline',
}

export function AutomationUrgencyBadge({ urgency }: { urgency: AutomationUrgency }) {
  return (
    <Badge variant={URGENCY_VARIANTS[urgency]} className="tracking-wide uppercase">
      {AUTOMATION_URGENCY_LABELS[urgency]}
    </Badge>
  )
}

export function AutomationHandledBadge() {
  return (
    <Badge variant="ghost" className="tracking-wide text-muted-foreground uppercase">
      Handled
    </Badge>
  )
}

/**
 * Where the reminder's facts came from. A synthetic birthday must never be
 * mistaken for official competition evidence, so this badge is not optional.
 */
export function AutomationSourceBadges({ sources }: { sources: AutomationSource[] }) {
  return (
    <>
      {sources.map((source) => (
        <Badge key={source} variant="ghost" className="text-muted-foreground">
          {AUTOMATION_SOURCE_LABELS[source]}
        </Badge>
      ))}
    </>
  )
}
