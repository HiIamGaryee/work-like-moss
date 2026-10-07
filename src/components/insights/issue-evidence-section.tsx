import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SupportingEvidence } from '@/components/insights/supporting-evidence'
import { InsightEvidenceList } from '@/components/insights/insight-evidence-list'
import type { HrAnalytics, EvidenceAnalysis } from '@/types/hr-analytics'
import type { HrInsight, LikelyDriver } from '@/types/hr-insights'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import { isInsightDetailSuppressed } from '@/utils/insight-privacy'

type IssueEvidenceSectionProps = {
  item: HrIntelligenceItem
  analytics: HrAnalytics | null
  drivers: LikelyDriver[]
}

const findGroupEvidence = (
  insight: HrInsight,
  analytics: HrAnalytics | null,
): EvidenceAnalysis | null => {
  if (!analytics || insight.scope.key === null) return null
  if (insight.scope.kind === 'division') {
    return analytics.evidence.divisions.find((entry) => entry.group === insight.scope.key) ?? null
  }
  if (insight.scope.kind === 'employee-group') {
    return analytics.evidence.employeeGroups.find((entry) => entry.group === insight.scope.key) ?? null
  }
  return null
}

export function IssueEvidenceSection({ item, analytics, drivers }: IssueEvidenceSectionProps) {
  const { insight } = item
  const suppressed = isInsightDetailSuppressed(item, analytics)
  const evidence = findGroupEvidence(insight, analytics)
  const sources = [...new Set([
    ...insight.dataSources,
    ...drivers.flatMap((driver) => driver.dataSources),
  ])]

  if (suppressed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Supporting Evidence</CardTitle>
          <CardDescription>Group-level evidence is protected by the response privacy rule.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Insufficient responses to display detailed evidence.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="issue-supporting-evidence-title">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle id="issue-supporting-evidence-title">Supporting Evidence</CardTitle>
            {sources.length > 1 ? <Badge variant="outline">{sources.length} sources</Badge> : null}
          </div>
          <CardDescription>
            Measures and aggregated themes available for {insight.affectedScope}. Evidence is
            descriptive and does not establish causation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sources.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <Badge key={source} variant="ghost" className="text-muted-foreground">
                  {source}
                </Badge>
              ))}
            </div>
          ) : null}
          {insight.evidence.length > 0 ? (
            <div className="border-t pt-1">
              <h3 className="mb-1 text-sm font-medium">Detected signal evidence</h3>
              <InsightEvidenceList evidence={insight.evidence} />
            </div>
          ) : null}
          {!evidence && insight.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No supporting evidence found.</p>
          ) : null}
        </CardContent>
      </Card>

      {evidence ? <SupportingEvidence evidence={evidence} /> : null}
    </section>
  )
}
