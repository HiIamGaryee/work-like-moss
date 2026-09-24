import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CAUSATION_NOTE, IMPACT_RULES_NOTE } from '@/data/hr-impact-rules'

const STEPS = [
  {
    step: '1',
    title: 'Capture the baseline',
    description:
      'When HR approves an action, the measure it targets and its current value are recorded and frozen.',
  },
  {
    step: '2',
    title: 'Match later survey data',
    description:
      'For completed demo actions, the engine looks for a later reading of the same metric, source and workforce scope, dated after completion.',
  },
  {
    step: '3',
    title: 'Assess movement and target separately',
    description:
      'Movement is classified using metric direction. A target is checked only when HR recorded a numeric target.',
  },
]

/**
 * How a number on this page came to exist. The method matters more than the
 * result: a reader who can follow the comparison can judge it, and the closing
 * note is the honest limit of what a before-and-after can show.
 */
export function MeasurementMethod() {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>How impact is measured</CardTitle>
        <CardDescription>
          Measurement uses the official workbook only. No survey wave is simulated and no result is
          projected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((item) => (
            <li key={item.step} className="min-w-0 space-y-1">
              <p className="inline-flex items-center gap-2 text-sm font-medium">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-xs text-background tabular-nums">
                  {item.step}
                </span>
                {item.title}
              </p>
              <p className="text-xs break-words text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ol>

        <div className="space-y-1 border-t pt-3">
          <p className="text-xs font-medium">{CAUSATION_NOTE}</p>
          <p className="text-xs text-muted-foreground">{IMPACT_RULES_NOTE}</p>
        </div>
      </CardContent>
    </Card>
  )
}
