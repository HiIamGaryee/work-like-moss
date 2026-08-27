import { EyeOff, ShieldCheck, UserCheck, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Principle = {
  icon: LucideIcon
  title: string
  description: string
}

/**
 * The three commitments this feature is built on, stated compactly. Short on
 * purpose: it belongs in a pitch, not in a policy document.
 */
const PRINCIPLES: readonly Principle[] = [
  {
    icon: ShieldCheck,
    title: 'Minimum data',
    description: 'Store only what the workflow needs. A birthday reminder keeps a month and a day.',
  },
  {
    icon: UserCheck,
    title: 'Human approval',
    description: 'Messages and actions require HR review. Nothing is sent automatically.',
  },
  {
    icon: EyeOff,
    title: 'No individual risk scoring',
    description: 'The system surfaces care and workplace signals, never a score about a person.',
  },
]

export function ResponsibleAutomation() {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Designed for responsible HR automation</CardTitle>
        <CardDescription>
          Care reminders touch people directly, so the boundaries are part of the design.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="min-w-0 space-y-1">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {title}
              </p>
              <p className="text-xs break-words text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
