import { InsightEvidenceList } from '@/components/insights/insight-evidence-list'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EVIDENCE_STRENGTH_LABELS } from '@/data/hr-root-cause-rules'
import type { EvidenceStrength, LikelyDriver } from '@/types/hr-insights'

type LikelyDriverCardProps = {
  driver: LikelyDriver
  rank: number
}

const STRENGTH_VARIANTS: Record<EvidenceStrength, 'default' | 'secondary' | 'outline'> = {
  strong: 'default',
  moderate: 'secondary',
  limited: 'outline',
}

export function LikelyDriverCard({ driver, rank }: LikelyDriverCardProps) {
  const crossSource = driver.dataSources.length > 1

  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{rank}</span>
          <CardTitle className="min-w-0 break-words">{driver.label}</CardTitle>
          <span className="ml-auto flex items-center gap-1.5">
            {crossSource ? <Badge variant="outline">Cross-source evidence</Badge> : null}
            <Badge variant={STRENGTH_VARIANTS[driver.evidenceStrength]}>
              {EVIDENCE_STRENGTH_LABELS[driver.evidenceStrength]}
            </Badge>
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{driver.explanation}</p>

        <div className="border-t pt-1">
          <InsightEvidenceList evidence={driver.evidence} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
          {driver.dataSources.map((source) => (
            <Badge key={source} variant="ghost" className="text-muted-foreground">
              {source}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
