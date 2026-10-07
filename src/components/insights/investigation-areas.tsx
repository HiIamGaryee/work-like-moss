import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { LikelyDriver } from '@/types/hr-insights'

type InvestigationAreasProps = {
  drivers: LikelyDriver[]
}

export function InvestigationAreas({ drivers }: InvestigationAreasProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggested Investigation Areas</CardTitle>
        <CardDescription>
          These are areas for HR to verify, not confirmed causes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No investigation area is supported by the available structured evidence.
          </p>
        ) : (
          <ol className="space-y-4">
            {drivers.map((driver, index) => (
              <li key={driver.id} className="space-y-1.5 border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                  <p className="text-sm font-medium">{driver.label}</p>
                  <Badge variant="outline">{driver.dataSources.length} source{driver.dataSources.length === 1 ? '' : 's'}</Badge>
                </div>
                <p className="pl-5 text-sm text-muted-foreground">HR should verify whether {driver.explanation.charAt(0).toLowerCase() + driver.explanation.slice(1)}</p>
                {driver.evidence[0] ? (
                  <p className="pl-5 text-xs text-muted-foreground">
                    Supporting reason: {driver.evidence[0].description}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
