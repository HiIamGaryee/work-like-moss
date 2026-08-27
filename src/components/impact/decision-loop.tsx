import { Check, Circle, Dot } from 'lucide-react'
import type { DecisionLoopStage } from '@/utils/decision-loop'

type DecisionLoopProps = {
  stages: DecisionLoopStage[]
}

const STAGE_ICONS = { complete: Check, current: Dot, pending: Circle } as const

/**
 * The traceability chain for one issue, at a glance:
 *
 *   Detect → Explain → Prioritise → Act → Measure
 *
 * A read-only picture, not a stepper: nothing here is clickable and no stage
 * gates the next. It exists so a reader can see how far a single decision has
 * travelled — and, honestly, where it has stopped.
 */
export function DecisionLoop({ stages }: DecisionLoopProps) {
  return (
    <ol className="flex flex-wrap items-start gap-x-1 gap-y-2">
      {stages.map((stage, index) => {
        const Icon = STAGE_ICONS[stage.status]
        const muted = stage.status === 'pending'

        return (
          <li key={stage.label} className="flex items-start gap-1">
            <div className="flex min-w-0 flex-col items-center gap-0.5 px-1">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  stage.status === 'complete'
                    ? 'border-foreground bg-foreground text-background'
                    : stage.status === 'current'
                      ? 'border-foreground text-foreground'
                      : 'border-dashed border-muted-foreground/50 text-muted-foreground'
                }`}
              >
                <Icon className="size-3" aria-hidden="true" />
              </span>
              <span
                className={`text-xs font-medium whitespace-nowrap ${muted ? 'text-muted-foreground' : ''}`}
              >
                {stage.label}
              </span>
              {stage.detail ? (
                <span className="text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                  {stage.detail}
                </span>
              ) : null}
            </div>
            {index < stages.length - 1 ? (
              <span
                aria-hidden="true"
                className="mt-2.5 h-px w-4 shrink-0 bg-border sm:w-6"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
