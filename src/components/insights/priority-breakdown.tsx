import { Progress } from '@/components/ui/progress'
import { PRIORITY_FORMULA_NOTE } from '@/data/hr-priority-rules'
import type { PriorityComponentDetail } from '@/types/hr-intelligence'
import { EMPTY_VALUE } from '@/utils/format'

type PriorityBreakdownProps = {
  components: PriorityComponentDetail[]
}

/**
 * Each component is a real 0–100 value from the published formula, so a bar is
 * meaningful here. A component the dataset could not supply shows an em dash and
 * a weight of 0 — its weight was redistributed across the others.
 */
export function PriorityBreakdown({ components }: PriorityBreakdownProps) {
  return (
    <div className="space-y-4">
      <dl className="space-y-3.5">
        {components.map((component) => (
          <div key={component.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="min-w-0 text-xs break-words text-muted-foreground">
                {component.label}
                <span className="ml-1.5 tabular-nums">
                  {Math.round(component.appliedWeight * 100)}%
                </span>
              </dt>
              <dd className="shrink-0 text-sm font-medium tabular-nums">
                {component.value === null ? EMPTY_VALUE : component.value}
              </dd>
            </div>
            <Progress value={component.value ?? 0} aria-label={`${component.label} component`} />
            <p className="text-xs text-muted-foreground">{component.description}</p>
          </div>
        ))}
      </dl>
      <p className="border-t pt-3 text-xs text-muted-foreground">{PRIORITY_FORMULA_NOTE}</p>
    </div>
  )
}
