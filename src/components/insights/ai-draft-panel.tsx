import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { HrAiDraft, HrAiDraftSource } from '@/types/hr-ai'
import type { RecommendedAction } from '@/types/hr-actions'

type AiDraftPanelProps = {
  draft: HrAiDraft | null
  source: HrAiDraftSource
  message?: string
  loading: boolean
  canGenerate: boolean
  onGenerate: () => void
  recommendation: RecommendedAction | null
}

export function AiDraftPanel({
  draft,
  source,
  message,
  loading,
  canGenerate,
  onGenerate,
  recommendation,
}: AiDraftPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" aria-hidden="true" />Draft Explanation / Recommendation</CardTitle>
          <Badge variant={source === 'ai-assisted' ? 'secondary' : 'outline'}>
            {source === 'ai-assisted' ? 'AI-assisted' : 'Rule-based draft'}
          </Badge>
          <Badge variant="outline">HR review required</Badge>
        </div>
        <CardDescription>
          Draft interpretation only. It uses aggregate evidence and never makes an HR decision.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {loading ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Generating draft…</p> : null}

        {draft ? (
          <div className="space-y-5">
            <section className="space-y-1">
              <h3 className="text-sm font-medium">Summary</h3>
              <p className="text-sm text-muted-foreground">{draft.summary}</p>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">Evidence themes</h3>
              <ul className="space-y-2 text-sm">
                {draft.evidenceThemes.map((theme) => (
                  <li key={`${theme.theme}-${theme.reason}`} className="rounded-md border p-3">
                    <p className="font-medium">{theme.theme}</p>
                    <p className="text-muted-foreground">{theme.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{theme.sourceCount} evidence source{theme.sourceCount === 1 ? '' : 's'}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-1 border-t pt-4">
              <h3 className="text-sm font-medium">Possible explanation</h3>
              <p className="text-sm text-muted-foreground">{draft.possibleExplanation}</p>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">Suggested investigation areas</h3>
              <ol className="space-y-2 text-sm">
                {draft.investigationAreas.map((area, index) => (
                  <li key={`${area.title}-${index}`}><span className="font-medium">{index + 1}. {area.title}</span><p className="text-muted-foreground">{area.reason}</p></li>
                ))}
              </ol>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">Suggested actions</h3>
              <ul className="space-y-2 text-sm">
                {draft.suggestedActions.map((action, index) => (
                  <li key={`${action.title}-${index}`} className="rounded-md border p-3">
                    <p className="font-medium">{action.title}</p>
                    <p className="text-muted-foreground">{action.description}</p>
                    {action.measurementSuggestion ? <p className="mt-1 text-xs text-muted-foreground">Measurement suggestion: {action.measurementSuggestion}</p> : null}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">Limitations</h3>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {draft.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            </section>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Generate a draft from the existing eligible group evidence.</p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={onGenerate} disabled={!canGenerate || loading}>
            {loading ? 'Generating draft…' : draft ? 'Regenerate draft' : 'Generate AI draft'}
          </Button>
          {recommendation ? <Button variant="outline" size="sm" asChild><Link to={`/actions?recommendation=${encodeURIComponent(recommendation.id)}`}>Review existing recommendation</Link></Button> : null}
        </div>
      </CardContent>
    </Card>
  )
}
