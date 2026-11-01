import { CommentThemeMentions } from '@/components/insights/comment-theme-mentions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SCORE_SCALE } from '@/data/hr-analytics.constants'
import type {
  DriverCandidate,
  EvidenceAnalysis,
  EvidenceItem,
  EvidenceSource,
  EvidenceStrength,
} from '@/types/hr-analytics'
import {
  formatCount,
  formatDelta,
  formatPercentage,
  formatScoreOutOf,
} from '@/utils/format'
import { canShowGroupDetail, PRIVACY_SUPPRESSED_MESSAGE } from '@/utils/insight-privacy'

const SOURCE_LABELS: Record<EvidenceSource, string> = {
  pulse: 'Pulse Survey',
  onboarding: 'Onboarding Survey',
  exit: 'Exit Survey',
}

const STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  strong: 'Strong supporting evidence',
  moderate: 'Moderate supporting evidence',
  limited: 'Limited evidence',
}

function formatEvidenceValue(item: EvidenceItem, value: number | null): string {
  return item.unit === 'score'
    ? formatScoreOutOf(value, SCORE_SCALE.max)
    : formatPercentage(value)
}

function DriverCard({ candidate }: { candidate: DriverCandidate }) {
  const keyItem = candidate.evidenceItems[0]
  const safeCommentMentions = candidate.commentMentions.filter((mention) => canShowGroupDetail(mention.totalComments))

  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">{candidate.label}</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{STRENGTH_LABELS[candidate.strength]}</Badge>
          {candidate.sources.map((source) => (
            <Badge key={source} variant="secondary">{SOURCE_LABELS[source]}</Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {keyItem ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <span>{keyItem.label}: {formatEvidenceValue(keyItem, keyItem.groupValue)}</span>
            <span>vs company {formatEvidenceValue(keyItem, keyItem.companyValue)}</span>
            <span>{formatDelta(keyItem.difference)} {keyItem.unit === 'score' ? 'points' : 'percentage points'}</span>
          </div>
        ) : null}
        <p className="text-muted-foreground">
          Smallest source n = {formatCount(candidate.sampleSize)}. {candidate.summary}
        </p>
        {safeCommentMentions.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {safeCommentMentions.map((mention) => (
              <li key={`${mention.source}:${mention.theme}`}>
                {SOURCE_LABELS[mention.source]} comment theme: {mention.mentionCount} of {mention.totalComments} comments mention {mention.label.toLowerCase()}
                {mention.isSmallSample ? ' (small sample)' : ''}. Mentions do not establish sentiment.
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

function EvidenceDetail({ item }: { item: EvidenceItem }) {
  return (
    <li className="grid gap-2 border-b py-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="font-medium">{item.label} <span className="font-normal text-muted-foreground">· {SOURCE_LABELS[item.source]}</span></p>
        <p className="text-xs text-muted-foreground">{item.note}</p>
      </div>
      <div className="text-left tabular-nums sm:text-right">
        <p>{formatEvidenceValue(item, item.groupValue)} vs {formatEvidenceValue(item, item.companyValue)}</p>
        <p className="text-xs text-muted-foreground">
          {formatDelta(item.difference)} {item.unit === 'score' ? 'points' : 'percentage points'} · n = {item.sampleSize}
          {item.isSmallSample ? ' · Small sample' : ''}
        </p>
      </div>
    </li>
  )
}

export function SupportingEvidence({
  evidence,
  headingId = 'supporting-evidence-title',
}: {
  evidence: EvidenceAnalysis
  headingId?: string
}) {
  const relatedItems = evidence.driverCandidates.flatMap((candidate) => candidate.evidenceItems)
  const uniqueItems = [...new Map(relatedItems.map((item) => [item.id, item])).values()]
  const sampleSizes = [
    ...uniqueItems.map((item) => item.sampleSize),
    ...evidence.exitReasons.map((item) => item.sampleSize),
  ]
  const safeCommentThemes = evidence.commentThemes.filter((item) => canShowGroupDetail(item.totalComments))
  const suppressed = (sampleSizes.length === 0 && safeCommentThemes.length === 0) || sampleSizes.some((sampleSize) => !canShowGroupDetail(sampleSize))

  if (suppressed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Supporting Evidence</CardTitle>
          <CardDescription>Group-level evidence is protected by the response privacy rule.</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{PRIVACY_SUPPRESSED_MESSAGE}</p></CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-5" aria-labelledby={headingId}>
      <div className="space-y-1">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight">
          Supporting Evidence · {evidence.group}
        </h2>
        <p className="text-sm text-muted-foreground">
          Group-level comparisons from Pulse, Onboarding and Exit responses. These related signals
          are observational and do not establish a cause.
        </p>
      </div>

      {evidence.driverCandidates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {evidence.driverCandidates.map((candidate) => (
            <DriverCard key={candidate.theme} candidate={candidate} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            No related dimension gap has comparable supporting evidence for this group.
          </CardContent>
        </Card>
      )}

      {uniqueItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Evidence Detail</CardTitle>
            <CardDescription>
              Each comparison uses the same source, measure and survey period for the group and
              company. n counts valid responses for that measure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul>{uniqueItems.map((item) => <EvidenceDetail key={item.id} item={item} />)}</ul>
          </CardContent>
        </Card>
      ) : null}

      {evidence.exitReasons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Structured Exit Reasons</CardTitle>
            <CardDescription>
              Shares use completed exit-survey responses with a recorded reason, not all leavers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {evidence.exitReasons.map((reason) => (
                <li key={reason.reason} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-b-0 last:pb-0">
                  <span>{reason.reason}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {reason.count} of {reason.sampleSize} · {formatPercentage(reason.share)}
                    {' '}vs company {formatPercentage(reason.companyShare)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {safeCommentThemes.length > 0 ? <CommentThemeMentions mentions={safeCommentThemes} /> : null}
    </section>
  )
}
