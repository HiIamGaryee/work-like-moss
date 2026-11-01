import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type InfoHintProps = {
  label: string
  hint: string
}

/**
 * The single explanation affordance on the dashboard. `label` names the metric
 * for screen readers so the icon is never an unlabelled control.
 */
export function InfoHint({ label, hint }: InfoHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={`What ${label} means`}
        className="rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[280px] items-start leading-snug">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}
