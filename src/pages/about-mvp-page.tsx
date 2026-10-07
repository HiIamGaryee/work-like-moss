import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isHrAiEnabled } from '@/services/hr-ai-draft.service'

const quickLinks = [
  { label: 'Overview', href: '/' },
  { label: 'Insights', href: '/insights' },
  { label: 'Actions', href: '/actions' },
  { label: 'Follow-Up Queue', href: '/automations' },
  { label: 'Impact', href: '/impact' },
  { label: 'FAQ & Mentor Questions', href: '/faq' },
] as const

const demoSteps = [
  {
    title: 'Start at Overview',
    route: '/',
    link: '/',
    click: 'Open the Management Attention queue.',
    show: 'Total employees, engagement, exit records, open actions, and one useful workforce signal.',
    say: 'This is where management sees the most important workforce signals.',
  },
  {
    title: 'Open one signal',
    route: '/insights',
    link: '/insights',
    click: 'Choose a clear high-priority division or group signal, then open it.',
    show: 'The affected group, current value, benchmark, difference, sample size, and priority.',
    say: 'The system identifies group-level patterns that may require HR attention.',
  },
  {
    title: 'Review the evidence',
    route: '/insights/:insightId',
    link: '/insights',
    click: 'Scroll through Supporting Evidence and the possible explanation.',
    show: 'Evidence sources, aggregated themes, signal strength, and suggested investigation areas.',
    say: 'We do not act based on one score alone. HR can see the supporting evidence first.',
  },
  {
    title: 'Review the recommendation',
    route: '/actions',
    link: '/actions',
    click: 'Open Review action on a suggested action.',
    show: 'The full action drawer with owner, deadline, baseline, target, success measure, and evidence.',
    say: 'The recommendation is only a draft. HR still controls the final decision.',
  },
  {
    title: 'Show action tracking',
    route: '/actions',
    link: '/actions',
    click: 'Use an existing approved action, or approve only if the demo can be reset afterward.',
    show: 'Owner, action status, delivery status, affected group, intended audience, reached audience, and coverage.',
    say: 'This shows whether the intervention reached the intended group.',
  },
  {
    title: 'Open follow-ups',
    route: '/automations',
    link: '/automations',
    click: 'Open the Follow-Up Queue and show the most urgent items.',
    show: 'Due items, overdue actions, delivery reviews, outcome reviews, and HR tasks.',
    say: 'Follow-up work is brought into one queue instead of relying on memory.',
  },
  {
    title: 'Review impact',
    route: '/impact',
    link: '/impact',
    click: 'Open an action impact record.',
    show: 'Delivery status, baseline, target, follow-up result, and before/after logic.',
    say: 'We separate whether an action happened from whether it actually improved the result.',
  },
  {
    title: 'End with privacy',
    route: 'Applied across the project',
    link: undefined,
    click: 'If useful, return to Overview and show an Insufficient responses state.',
    show: 'Group-level analysis, minimum response protection of five, and aggregated evidence.',
    say: 'The MVP analyses eligible groups, not individual employees.',
  },
] as const

const beforeDemo = [
  'Overview loads with at least one useful Management Attention signal.',
  'An insight detail page opens successfully.',
  'Supporting Evidence contains data.',
  'Actions loads and Review action opens.',
  'Follow-Up Queue contains demo items.',
  'Impact loads with an action record.',
  'No unwanted actions have already been approved or rejected.',
  'Browser zoom is comfortable and developer tools are hidden.',
] as const

const demoNotes = [
  'Do not say that AI decides what HR should do. Say that it assists with a draft.',
  'Do not say that delivery proves success. Wait for comparable follow-up data.',
  'Do not present individual survey scores or negative employee judgements.',
  'Use Reset demo on the Actions page if the walkthrough changes the demo state.',
] as const

export function DemoGuidePage() {
  const aiEnabled = isHrAiEnabled()
  const completedModules = aiEnabled ? 10 : 9

  return (
    <div className="w-full space-y-8">
      <section className="rounded-xl border bg-card p-6 sm:p-8">
        <div className="max-w-3xl space-y-4">
          <Badge variant="outline">Internal Demo Guide</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Work Like Moss — MVP Demo Guide</h1>
            <p className="text-lg font-medium text-muted-foreground">A short runbook for presenting the signal-to-action workflow.</p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">Follow the steps in order. Each step tells you where to go, what to click, what to show, and what to say.</p>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => <Button key={link.href} size="sm" variant="outline" asChild><Link to={link.href}>{link.label}<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button>)}
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="run-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1"><h2 id="run-title" className="text-2xl font-semibold tracking-tight">Run the Demo</h2><p className="text-sm text-muted-foreground">Management signal → evidence → HR action → follow-up → outcome.</p></div>
          <Badge variant="secondary">{completedModules} / 10 core modules complete</Badge>
        </div>
        <ol className="space-y-4">
          {demoSteps.map((step, index) => <li key={step.title} className="rounded-xl border bg-card p-5 sm:p-6"><div className="flex items-start gap-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span><div className="min-w-0 flex-1 space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold">{step.title}</h3><code className="text-xs text-muted-foreground">{step.route}</code></div>{step.link ? <Button size="sm" variant="outline" asChild><Link to={step.link}>Open page<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button> : null}</div><div className="grid gap-4 md:grid-cols-3"><div><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Click</p><p className="mt-1 text-sm leading-5">{step.click}</p></div><div><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Show</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{step.show}</p></div><div><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Say</p><p className="mt-1 border-l-2 pl-3 text-sm leading-5 text-muted-foreground">“{step.say}”</p></div></div></div></div></li>)}
        </ol>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-labelledby="prep-title">
        <Card><CardHeader><CardTitle id="prep-title">Before Presenting</CardTitle><CardDescription>Quick checks before someone else takes the controls.</CardDescription></CardHeader><CardContent className="space-y-3">{beforeDemo.map((item) => <div key={item} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{item}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Important Demo Notes</CardTitle><CardDescription>Keep the claims accurate and the walkthrough calm.</CardDescription></CardHeader><CardContent className="space-y-3">{demoNotes.map((note) => <div key={note} className="flex items-start gap-2 text-sm"><span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" /><span>{note}</span></div>)}</CardContent></Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-labelledby="status-title">
        <Card><CardHeader><CardTitle id="status-title">Current MVP Status</CardTitle><CardDescription>The count reflects the current AI configuration.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-5"><div><p className="text-3xl font-semibold tabular-nums">{completedModules} / 10</p><p className="text-sm text-muted-foreground">Core modules complete</p></div><Badge variant={aiEnabled ? 'default' : 'secondary'}>{aiEnabled ? 'AI COMPLETE' : 'AI PARTIAL'}</Badge></CardContent></Card>
        <Card><CardHeader><CardTitle>Current limitations</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Demo data is loaded from the bundled workbook.</li><li>Some workflow state is stored in browser localStorage.</li><li>There is no full multi-user backend persistence yet.</li>{!aiEnabled ? <li>Live Gemini drafting is disabled until the secure AI server boundary is enabled.</li> : null}</ul></CardContent></Card>
      </section>

      <div className="flex items-center gap-2 border-t pt-5 text-sm text-muted-foreground"><RotateCcw className="size-4" aria-hidden="true" /><span>If you change an action during the demo, use “Reset demo” in Actions before the next run.</span></div>
    </div>
  )
}

export const AboutMvpPage = DemoGuidePage
