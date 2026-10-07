import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSearch,
  GitBranch,
  Gauge,
  Handshake,
  LockKeyhole,
  Ruler,
  Search,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isHrAiEnabled } from '@/services/hr-ai-draft.service'

type ModuleStatus = 'COMPLETE' | 'PARTIAL'

const solutionSteps = [
  { label: 'Data', description: 'Combine employee lifecycle and feedback information.', icon: Database },
  { label: 'Detect', description: 'Identify unusual division or employee-group signals.', icon: Search },
  { label: 'Explain', description: 'Show supporting evidence and possible contributing factors.', icon: FileSearch },
  { label: 'Prioritise', description: 'Help HR focus on the issues that need attention.', icon: Gauge },
  { label: 'Act', description: 'Assign an owner, deadline, baseline, and target.', icon: ClipboardCheck },
  { label: 'Follow Up', description: 'Track delivery, reminders, and review tasks.', icon: GitBranch },
  { label: 'Measure', description: 'Compare baseline and follow-up results.', icon: Ruler },
] as const

const problems = [
  'Employee feedback exists, but important problems are difficult to identify quickly.',
  'Survey, onboarding, exit, and action data are often viewed separately.',
  'HR actions may have no clear owner, deadline, or measurable target.',
  'Management may know an action was delivered, but not whether it improved employee experience.',
] as const

const modules = [
  { title: 'Management Overview', description: 'Shows workforce KPIs, exit records, open actions, and priority management signals.', status: 'COMPLETE' as const },
  { title: 'Signal Detection', description: 'Detects unusual division and employee-group patterns using HR data and company benchmarks.', status: 'COMPLETE' as const },
  { title: 'Evidence View', description: 'Combines pulse survey, onboarding, exit, comment-theme, and cross-source evidence.', status: 'COMPLETE' as const },
  { title: 'Issue Detail', description: 'Shows the current signal, benchmark, evidence, possible explanation, investigation areas, and recommended next step.', status: 'COMPLETE' as const },
  { title: 'AI-Assisted Drafting', description: 'Helps HR draft evidence-based explanations, investigation areas, and possible actions while HR remains the final decision-maker.', status: (isHrAiEnabled() ? 'COMPLETE' : 'PARTIAL') as ModuleStatus },
  { title: 'HR Action Approval', description: 'HR can review, edit, approve, or reject actions with owner, deadline, baseline, target, and success measure.', status: 'COMPLETE' as const },
  { title: 'Action Tracking', description: 'Tracks ownership, delivery status, affected group, audience coverage, and action history.', status: 'COMPLETE' as const },
  { title: 'Follow-Up Queue', description: 'Combines onboarding follow-ups, overdue actions, delivery reviews, outcome reviews, and HR tasks.', status: 'COMPLETE' as const },
  { title: 'Outcome Measurement', description: 'Separates delivery from success and compares baseline against later comparable results.', status: 'COMPLETE' as const },
  { title: 'Privacy Protection', description: 'Protects small groups, prevents individual negative scoring, and keeps detailed analytics at eligible group level.', status: 'COMPLETE' as const },
] as const

const typicalFlow = [
  'HR opens Management Overview',
  'HR notices a high-priority workforce signal',
  'HR opens the Issue Detail',
  'HR reviews supporting evidence',
  'HR reviews the draft explanation or recommendation',
  'HR edits and approves an action',
  'An owner and deadline are assigned',
  'Delivery is tracked',
  'Follow-up tasks appear in the Follow-Up Queue',
  'HR reviews later results in Outcome Measurement',
] as const

const principles = [
  { title: 'Human Review', description: 'AI and recommendations never make the final HR decision.', icon: Handshake },
  { title: 'Group-Level Privacy', description: 'Detailed analytics are protected for small groups and individual negative scoring is avoided.', icon: LockKeyhole },
  { title: 'Evidence Before Action', description: 'Signals are supported by available evidence instead of one isolated score or comment.', icon: FileSearch },
  { title: 'Delivery Is Not Success', description: 'The system separates whether an action happened from whether the employee outcome improved.', icon: CheckCircle2 },
] as const

const dataSources = [
  { title: 'Employee records', description: 'Workforce structure, status, division, group, and tenure.' },
  { title: 'Pulse surveys', description: 'Engagement and employee experience measures across waves.' },
  { title: 'Onboarding surveys', description: 'New-joiner experience and onboarding dimensions.' },
  { title: 'Exit surveys', description: 'Exit experience and recorded reasons for leaving.' },
  { title: 'Action tracker', description: 'Existing actions, owners, dates, statuses, and success measures.' },
] as const

const quickLinks = [
  { label: 'View Management Overview', href: '/' },
  { label: 'View Insights', href: '/insights' },
  { label: 'View Actions', href: '/actions' },
  { label: 'View Follow-Up Queue', href: '/automations' },
  { label: 'View Outcome / Impact', href: '/impact' },
] as const

const statusVariant = (status: ModuleStatus): 'default' | 'secondary' =>
  status === 'COMPLETE' ? 'default' : 'secondary'

export function AboutMvpPage() {
  const completeCount = modules.filter((module) => module.status === 'COMPLETE').length
  const aiEnabled = isHrAiEnabled()

  return (
    <div className="w-full space-y-8">
      <section className="relative overflow-hidden rounded-xl border bg-card p-6 sm:p-8 lg:p-10">
        <div className="relative max-w-3xl space-y-5">
          <Badge variant="outline">MVP Prototype</Badge>
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-wide text-muted-foreground">Workforce intelligence for better HR decisions</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Work Like Moss</h1>
            <p className="text-xl font-medium tracking-tight text-muted-foreground sm:text-2xl">Turning employee signals into actions.</p>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Work Like Moss is an HR intelligence and action-management prototype that helps management identify workforce issues, understand supporting evidence, assign actions, follow up on delivery, and measure whether improvements actually occur.
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><UsersRound className="size-4" aria-hidden="true" />Built around group-level HR analytics, human review, privacy protection, and measurable follow-up.</p>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="problem-title">
        <div className="space-y-1"><h2 id="problem-title" className="text-2xl font-semibold tracking-tight">The Problem</h2><p className="text-sm text-muted-foreground">Important workforce signals can get lost between separate systems and follow-up tasks.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem, index) => <Card key={problem}><CardHeader><span className="text-2xl font-semibold text-muted-foreground">0{index + 1}</span></CardHeader><CardContent><p className="text-sm leading-6">{problem}</p></CardContent></Card>)}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="solution-title">
        <div className="space-y-1"><h2 id="solution-title" className="text-2xl font-semibold tracking-tight">Our Solution</h2><p className="text-sm text-muted-foreground">A connected workflow from evidence to measurable follow-up.</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {solutionSteps.map((step, index) => { const Icon = step.icon; return <div key={step.label} className="relative rounded-lg border bg-card p-4"><div className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /><span className="text-sm font-semibold">{step.label}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p>{index < solutionSteps.length - 1 ? <ArrowRight className="absolute -right-2 top-6 z-10 hidden size-4 bg-background text-muted-foreground xl:block" aria-hidden="true" /> : null}</div> })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="modules-title">
        <div className="space-y-1"><h2 id="modules-title" className="text-2xl font-semibold tracking-tight">What This MVP Includes</h2><p className="text-sm text-muted-foreground">The core product loop is implemented end to end, with live AI enabled only when securely configured.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module, index) => <Card key={module.title} className="min-w-0"><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><CardTitle className="text-base">{module.title}</CardTitle></div><Badge variant={statusVariant(module.status)}>{module.status}</Badge></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{module.description}</p></CardContent></Card>)}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)]" aria-labelledby="status-title">
        <Card><CardHeader><CardTitle id="status-title">MVP Status</CardTitle><CardDescription>Current implementation status across the ten core modules.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-6"><div><p className="text-4xl font-semibold tracking-tight tabular-nums">{completeCount} / {modules.length}</p><p className="text-sm text-muted-foreground">Core modules complete</p></div><div className="flex flex-wrap gap-2"><Badge>COMPLETE · {completeCount}</Badge><Badge variant="secondary">PARTIAL · {modules.length - completeCount}</Badge></div></CardContent></Card>
        <Card><CardHeader><CardTitle>AI drafting status</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2"><Sparkles className="size-4 text-muted-foreground" aria-hidden="true" /><Badge variant={aiEnabled ? 'default' : 'secondary'}>{aiEnabled ? 'COMPLETE' : 'PARTIAL'}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{aiEnabled ? 'Gemini drafting is enabled through the secure server boundary.' : 'Gemini support is implemented but disabled until VITE_AI_ENABLED is enabled.'}</p></CardContent></Card>
      </section>

      <section className="space-y-4" aria-labelledby="flow-title">
        <div className="space-y-1"><h2 id="flow-title" className="text-2xl font-semibold tracking-tight">Typical HR Flow</h2><p className="text-sm text-muted-foreground">How a reviewer moves through the product.</p></div>
        <Card><CardContent className="pt-6"><ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{typicalFlow.map((step, index) => <li key={step} className="relative flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><span className="pt-1 text-sm leading-5">{step}</span></li>)}</ol></CardContent></Card>
      </section>

      <section className="space-y-4" aria-labelledby="guardrails-title">
        <div className="space-y-1"><h2 id="guardrails-title" className="text-2xl font-semibold tracking-tight">Built With Guardrails</h2><p className="text-sm text-muted-foreground">The product keeps human judgement, privacy, and evidence at the centre.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{principles.map((principle) => { const Icon = principle.icon; return <Card key={principle.title}><CardHeader><Icon className="size-5 text-muted-foreground" aria-hidden="true" /><CardTitle className="text-base">{principle.title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{principle.description}</p></CardContent></Card> })}</div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Data Used in the MVP</CardTitle><CardDescription>Sources available in the bundled HR workbook and action workflow.</CardDescription></CardHeader><CardContent><ul className="space-y-3">{dataSources.map((source) => <li key={source.title} className="flex gap-3"><Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><p className="text-sm font-medium">{source.title}</p><p className="text-xs leading-5 text-muted-foreground">{source.description}</p></div></li>)}</ul></CardContent></Card>
        <Card><CardHeader><CardTitle>Current MVP Limitations</CardTitle><CardDescription>What remains intentionally lightweight in this prototype.</CardDescription></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Demo data is loaded from the bundled workbook.</li><li>Some workflow state is stored in browser localStorage.</li><li>There is no full multi-user backend persistence yet.</li>{!aiEnabled ? <li>Gemini drafting requires enabling the secure server boundary and VITE_AI_ENABLED.</li> : null}</ul></CardContent></Card>
      </section>

      <section className="space-y-4" aria-labelledby="explore-title">
        <div className="space-y-1"><h2 id="explore-title" className="text-2xl font-semibold tracking-tight">Explore the MVP</h2><p className="text-sm text-muted-foreground">Jump straight into the main product flows.</p></div>
        <div className="flex flex-wrap gap-2">{quickLinks.map((link) => <Button key={link.href} variant="outline" asChild><Link to={link.href}>{link.label}<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button>)}</div>
      </section>
    </div>
  )
}
