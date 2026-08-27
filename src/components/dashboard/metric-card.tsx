import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { InfoHint } from '@/components/dashboard/info-hint'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChangeDirection } from '@/types/hr-analytics'

export type MetricCardProps = {
  label: string
  value: string
  description?: string
  hint?: string
  trend?: {
    direction: ChangeDirection
    label: string
  }
}

/**
 * Deliberately monochrome: direction is carried by the arrow, not by colour, so
 * "up" is never pre-judged as good or bad at this stage.
 */
const TREND_ICONS: Record<ChangeDirection, ComponentType<{ className?: string }>> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
}

export function MetricCard({ label, value, description, hint, trend }: MetricCardProps) {
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null

  return (
    <Card size="sm" className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {label}
          {hint ? <InfoHint label={label} hint={hint} /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        {trend && TrendIcon ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{trend.label}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
