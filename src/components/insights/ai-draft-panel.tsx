import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_HR_AI_DEPTH, DEFAULT_HR_AI_MODE, getHrAiModeLabel, HR_AI_DEPTHS, HR_AI_FOCUS_AREAS, HR_AI_MODES } from '@/data/hr-ai-modes'
import type { HrAiDraft, HrAiDraftSource, HrAiGenerationOptions, HrAiMode } from '@/types/hr-ai'
import type { RecommendedAction } from '@/types/hr-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

type AiDraftPanelProps = {
  draft: HrAiDraft | null
  source: HrAiDraftSource
  message?: string
  loading: boolean
  canGenerate: boolean
  onGenerate: (options: HrAiGenerationOptions) => void
  recommendation: RecommendedAction | null
  aiEnabled: boolean
  evidenceSources: string[]
}

function ModeGuideDetails({ mode }: { mode: HrAiMode }) {
  const info = HR_AI_MODES.find((entry) => entry.key === mode) ?? HR_AI_MODES[0]
  const listSections = [
    { title: 'Best used when', items: info.bestUsedWhen },
    { title: 'Focuses on', items: info.focusAreas },
    { title: 'Questions this lens considers', items: info.exampleQuestions },
    { title: 'Typical actions', items: info.typicalActions },
    { title: 'What this lens will not do', items: info.willNotDo },
  ] as const

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{info.label}</h3>
        <p className="text-sm text-muted-foreground">{info.description}</p>
      </div>
      <section className="space-y-2 rounded-lg border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Purpose</h4>
        <p className="text-sm leading-6 text-muted-foreground">{info.purpose}</p>
      </section>
      {listSections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h4 className="text-sm font-semibold">{section.title}</h4>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
            {section.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
      <section className="space-y-2 rounded-lg border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Example output style</h4>
        <p className="text-sm leading-6 text-muted-foreground">“{info.outputStyle}”</p>
      </section>
    </div>
  )
}

export function AiDraftPanel({
  draft,
  source,
  message,
  loading,
  canGenerate,
  onGenerate,
  recommendation,
  aiEnabled,
  evidenceSources,
}: AiDraftPanelProps) {
  const [mode, setMode] = useState<HrAiMode>(draft?.mode ?? DEFAULT_HR_AI_MODE)
  const [depth, setDepth] = useState(DEFAULT_HR_AI_DEPTH)
  const [focusAreas, setFocusAreas] = useState<string[]>([])
  const [customInstruction, setCustomInstruction] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideMode, setGuideMode] = useState<HrAiMode>(mode)

  const toggleFocus = (focus: string): void => {
    setFocusAreas((current) => current.includes(focus)
      ? current.filter((entry) => entry !== focus)
      : current.length < 3 ? [...current, focus] : current)
  }

  const handleGenerate = (): void => {
    onGenerate({ mode, depth, focusAreas, customInstruction: customInstruction.trim() || undefined })
  }

  const summary = draft?.executiveSummary ?? draft?.summary

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" aria-hidden="true" />AI HR Copilot</CardTitle>
          <Badge variant={source === 'ai-assisted' ? 'secondary' : 'outline'}>{source === 'ai-assisted' ? 'AI-assisted' : 'Rule-based draft'}</Badge>
          <Badge variant="outline">HR review required</Badge>
        </div>
        <CardDescription>Choose an HR lens to change how the evidence is interpreted and what areas are suggested for investigation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="hr-copilot-mode">Analyse this signal as</Label>
              <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => { setGuideMode(mode); setGuideOpen(true) }}>More info</Button>
            </div>
            <Select value={mode} onValueChange={(value) => setMode(value as HrAiMode)}>
              <SelectTrigger id="hr-copilot-mode"><SelectValue /></SelectTrigger>
              <SelectContent>{HR_AI_MODES.map((entry) => <SelectItem key={entry.key} value={entry.key}>{entry.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{HR_AI_MODES.find((entry) => entry.key === mode)?.helper}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr-copilot-depth">Analysis depth</Label>
            <Select value={depth} onValueChange={(value) => setDepth(value as typeof depth)}>
              <SelectTrigger id="hr-copilot-depth"><SelectValue /></SelectTrigger>
              <SelectContent>{HR_AI_DEPTHS.map((entry) => <SelectItem key={entry.key} value={entry.key}>{entry.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{HR_AI_DEPTHS.find((entry) => entry.key === depth)?.description}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Focus areas <span className="font-normal text-muted-foreground">(up to 3)</span></Label>
          <div className="flex flex-wrap gap-2">
            {HR_AI_FOCUS_AREAS.map((focus) => <Button key={focus} type="button" size="sm" variant={focusAreas.includes(focus) ? 'secondary' : 'outline'} onClick={() => toggleFocus(focus)} disabled={!focusAreas.includes(focus) && focusAreas.length >= 3}>{focus}</Button>)}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hr-copilot-instruction">Additional HR focus</Label>
          <Textarea id="hr-copilot-instruction" value={customInstruction} onChange={(event) => setCustomInstruction(event.target.value.slice(0, 500))} placeholder="Example: Focus more on manager support and practical interventions that can be completed within 60 days." rows={3} />
          <p className="text-xs text-muted-foreground">Optional. This guides the analysis but does not override privacy or evidence rules.</p>
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {loading ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Generating HR analysis…</p> : null}

        {draft ? (
          <div className="space-y-5 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-xs text-muted-foreground">Analysis lens</p><p className="text-sm font-medium">{getHrAiModeLabel(draft.mode ?? mode)}</p></div>
              <div className="flex items-center gap-2"><Badge variant={source === 'ai-assisted' ? 'secondary' : 'outline'}>{source === 'ai-assisted' ? 'AI-assisted draft' : 'Evidence-based draft'}</Badge><Badge variant="outline">HR review required</Badge></div>
            </div>

            {summary ? <section className="space-y-1"><h3 className="text-sm font-medium">Executive Summary</h3><p className="text-sm text-muted-foreground">{summary}</p></section> : null}
            {draft.observedSignal ? <section className="space-y-1 border-t pt-4"><h3 className="text-sm font-medium">Observed Signal</h3><p className="text-sm text-muted-foreground">{draft.observedSignal}</p></section> : null}
            {draft.evidenceInterpretation ? <section className="space-y-1 border-t pt-4"><h3 className="text-sm font-medium">Evidence Interpretation</h3><p className="text-sm text-muted-foreground">{draft.evidenceInterpretation}</p></section> : null}

            <section className="space-y-2 border-t pt-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">Evidence Used</h3><span className="text-xs text-muted-foreground">{evidenceSources.length} source{evidenceSources.length === 1 ? '' : 's'}</span></div><div className="flex flex-wrap gap-1.5">{evidenceSources.map((sourceName) => <Badge key={sourceName} variant="ghost" className="text-muted-foreground">{sourceName}</Badge>)}</div><ul className="space-y-2 text-sm">{draft.evidenceThemes.map((theme) => <li key={`${theme.theme}-${theme.reason}`} className="rounded-md border bg-muted/20 p-3"><p className="font-medium">{theme.theme}</p><p className="text-muted-foreground">{theme.reason}</p><p className="mt-1 text-xs text-muted-foreground">{theme.sourceCount} supporting source{theme.sourceCount === 1 ? '' : 's'}</p></li>)}</ul></section>

            <section className="space-y-1 border-t pt-4"><h3 className="text-sm font-medium">Possible Explanation</h3><p className="text-sm text-muted-foreground">{draft.possibleExplanation}</p></section>

            <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-medium">Suggested Investigation Areas</h3><ol className="space-y-3 text-sm">{draft.investigationAreas.map((area, index) => <li key={`${area.title}-${index}`}><p className="font-medium">{index + 1}. {area.title}</p><p className="text-muted-foreground">{area.reason}</p>{area.evidenceBasis ? <p className="mt-1 text-xs text-muted-foreground">Supported by: {area.evidenceBasis}</p> : null}</li>)}</ol></section>

            {draft.questionsForHr && draft.questionsForHr.length > 0 ? <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-medium">Questions HR Should Ask</h3><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{draft.questionsForHr.map((question) => <li key={question}>{question}</li>)}</ul></section> : null}

            <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-medium">Suggested Actions</h3><ul className="space-y-2 text-sm">{draft.suggestedActions.map((action, index) => <li key={`${action.title}-${index}`} className="rounded-md border p-3"><p className="font-medium">{action.title}</p><p className="text-muted-foreground">{action.description}</p>{action.suggestedOwner ? <p className="mt-1 text-xs text-muted-foreground">Suggested owner: {action.suggestedOwner}</p> : null}{action.suggestedMeasure ?? action.measurementSuggestion ? <p className="mt-1 text-xs text-muted-foreground">Suggested measure: {action.suggestedMeasure ?? action.measurementSuggestion}</p> : null}</li>)}</ul></section>

            <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-medium">Limitations</h3><ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">{draft.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>
          </div>
        ) : <p className="text-sm text-muted-foreground">Generate a draft from the existing eligible group evidence.</p>}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={handleGenerate} disabled={!canGenerate || loading}>{!aiEnabled ? 'AI drafting disabled' : loading ? 'Generating HR analysis…' : draft ? 'Regenerate HR analysis' : 'Generate HR Analysis'}</Button>
          {recommendation ? <Button variant="outline" size="sm" asChild><Link to={`/actions?recommendation=${encodeURIComponent(recommendation.id)}`}>Use in Action Review</Link></Button> : null}
        </div>
      </CardContent>
      <Sheet open={guideOpen} onOpenChange={setGuideOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>HR Lens Guide</SheetTitle>
            <SheetDescription>Browse professional HR analysis lenses. Switching a lens does not generate analysis.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {HR_AI_MODES.map((entry) => <Button key={entry.key} type="button" size="sm" variant={guideMode === entry.key ? 'secondary' : 'outline'} onClick={() => setGuideMode(entry.key)}>{entry.label}</Button>)}
            </div>
            <ModeGuideDetails mode={guideMode} />
          </div>
          <SheetFooter>
            <Button type="button" onClick={() => { setMode(guideMode); setGuideOpen(false) }}>Use this lens</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
