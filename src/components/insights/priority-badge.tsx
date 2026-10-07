import { Badge } from '@/components/ui/badge'
import { PRIORITY_LEVEL_LABELS } from '@/data/hr-priority-rules'
import type { PriorityLevel } from '@/types/hr-intelligence'

/**
 * Monochrome by weight, not colour: the four levels stay distinguishable in
 * greyscale and the word itself carries the meaning.
 */
const LEVEL_VARIANTS: Record<PriorityLevel, 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'outline',
  low: 'ghost',
}

type PriorityBadgeProps = {
  level: PriorityLevel
  score?: number
}

export function PriorityBadge({ level, score }: PriorityBadgeProps) {
  return (
    <Badge variant={LEVEL_VARIANTS[level]} className="tabular-nums">
      {PRIORITY_LEVEL_LABELS[level]}
      {score !== undefined ? ` · ${score}` : ''}
    </Badge>
  )
}
