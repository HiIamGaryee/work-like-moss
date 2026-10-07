import { Link } from 'react-router-dom'
import { SupportingEvidence } from '@/components/insights/supporting-evidence'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PriorityIssue, PrioritySource } from '@/types/hr-analytics'
import { formatCount } from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

const SOURCE_LABELS: Record<PrioritySource, string> = {
  employees: 'Employees',
  pulse: 'Pulse',
  onboarding: 'Onboarding',
  exit: 'Exit',
}

const BREAKDOWN_COMPONENTS = [
  { key: 'severity', label: 'Severity' },
  { key: 'reach', label: 'Reach' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'urgency', label: 'Urgency' },
] as const

function SuggestedPriorityCard({ issue, rank }: { issue: PriorityIssue; rank: number }) {
  const bandLabel = issue.priorityBand[0].toUpperCase() + issue.priorityBand.slice(1)
  const suppressed = !canShowGroupDetail(issue.sampleSize)

  return (
    <li>
      <Card className="min-w-0">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">#{rank} · {issue.scopeType === 'employee_group' ? 'Employee Group' : issue.scopeType === 'division' ? 'Division' : 'Company'} · {issue.scopeName}</p>
              <CardTitle className="text-base">{issue.title}</CardTitle>
            </div>
            {!suppressed ? <Badge variant="outline" className="shrink-0 tabular-nums">
              {bandLabel} · {issue.priorityScore} / 100
            </Badge> : null}
          </div>
          {!suppressed ? <div className="flex flex-wrap gap-1.5">
            {issue.sources.map((source) => (
              <Badge key={source} variant="secondary">{SOURCE_LABELS[source]}</Badge>
            ))}
          </div> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {suppressed ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{PRIVACY_SUPPRESSED_MESSAGE}</p> : <>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/actions?issue=${encodeURIComponent(issue.id)}`}>Review Action</Link>
          </Button>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {BREAKDOWN_COMPONENTS.map(({ key, label }) => (
              <div key={key} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">
                  {issue.breakdown[key].score === null
                    ? 'Unavailable'
                    : `${formatCount(issue.breakdown[key].score)} / 100`}
                </dd>
              </div>
            ))}
          </dl>

          <details className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">How this score was calculated</summary>
            <dl className="mt-4 space-y-3">
              {BREAKDOWN_COMPONENTS.map(({ key, label }) => (
                <div key={key}>
                  <dt className="font-medium">{label} · {issue.breakdown[key].score === null ? 'Unavailable' : `${issue.breakdown[key].score} / 100`}</dt>
                  <dd className="text-muted-foreground">{issue.breakdown[key].reason}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Missing components are omitted and the available weights are renormalised.
              This is a deterministic review aid, not a statistical prediction.
            </p>
          </details>

          {issue.supportingEvidence ? (
            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Supporting Evidence</summary>
              <div className="mt-4">
                <SupportingEvidence
                  evidence={issue.supportingEvidence}
                  headingId={`priority-evidence-${issue.id}`}
                />
              </div>
            </details>
          ) : null}
          </>}
        </CardContent>
      </Card>
    </li>
  )
}

export function SuggestedPriorities({ issues }: { issues: readonly PriorityIssue[] }) {
  return (
    <section className="space-y-4" aria-labelledby="suggested-priorities-title">
      <div className="space-y-1">
        <h2 id="suggested-priorities-title" className="text-xl font-semibold tracking-tight">
          Suggested Priorities
        </h2>
        <p className="text-sm text-muted-foreground">
          Scores help organise group-level review. Final decisions remain with HR.
        </p>
      </div>
      {issues.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No comparable issues to rank</CardTitle>
            <CardDescription>
              The current dataset does not meet the transparent issue rules, or comparable data
              is unavailable.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ol className="space-y-4">
          {issues.map((issue, index) => (
            <SuggestedPriorityCard key={issue.id} issue={issue} rank={index + 1} />
          ))}
        </ol>
      )}
    </section>
  )
}
