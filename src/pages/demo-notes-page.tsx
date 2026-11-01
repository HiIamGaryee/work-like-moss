import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const prep = [
  'npm run dev is running, site open at /login',
  'Log in as HR, Demo menu, Reset demo (clears old approvals)',
  'Click through once: Overview, Signals, one signal, Actions, Follow-Up, Impact',
  'Stay on /login when the meeting starts',
  'Silence notifications, close Slack and Mail, plug in charger',
  'Backup: if the app dies, open /about (Demo Guide)',
] as const

const steps = [
  {
    time: '0:00 - 0:25',
    title: 'The problem',
    screen: '/login',
    todo: ['Point at the role cards. Do not click yet.', 'Click HR (spinner 2.4s).'],
    say: [
      'Most companies find out someone is unhappy when the resignation letter arrives. Work Like Moss turns the data HR already has, pulse surveys, exits, onboarding, into early warnings, and then tracks whether the fix actually worked. There are three roles: HR, Manager, and CEO. I will start as HR.',
      'During spinner: Everything you see runs on a synthetic company dataset. No real employee data.',
    ],
  },
  {
    time: '0:25 - 0:55',
    title: 'Overview',
    screen: '/',
    todo: [
      'Let the page load. Point at the KPI row.',
      'Scroll to Management Attention.',
      'Click the top item (or Signals in the sidebar).',
    ],
    say: [
      "This is HR's home. Total employees, leaver rate, engagement, new joiner experience, open actions. But the number that matters is this queue, Management Attention. The system has already ranked the workforce problems by priority, so HR does not hunt through spreadsheets.",
    ],
  },
  {
    time: '0:55 - 1:30',
    title: 'Signal and evidence',
    screen: '/insights/:id',
    todo: [
      'Point at: affected group, current value, benchmark, difference, sample size, priority.',
      'Scroll to Supporting Evidence, then the possible explanation.',
      'Optional (5s): open the AI Draft panel, show the lens selector.',
    ],
    say: [
      'Each signal shows the group, the score, the benchmark, and how far off it is. Below that is the evidence: exit reasons, comment themes, survey trends. We never act on one score alone. HR sees the proof first. And privacy is built in: groups under five responses are suppressed, so we analyse teams, never individuals.',
      'AI draft: The AI only drafts. Different HR lenses, same data. HR decides.',
    ],
  },
  {
    time: '1:30 - 2:10',
    title: 'Actions',
    screen: '/actions',
    todo: [
      'Sidebar, Actions. Click Review action on a suggested action.',
      'Point at: owner, deadline, baseline, target, success measure.',
      'Close the drawer WITHOUT approving.',
      'Point at an approved action: status, delivery, intended vs reached audience, coverage.',
    ],
    say: [
      'From the signal, the system suggests an action. Owner, deadline, baseline, target, and how we will measure success. This is only a draft. HR stays the decision maker. Once approved, we track delivery: who was meant to be reached, who actually was, and the coverage. So the CEO can see the action really happened, not just that someone planned it.',
    ],
  },
  {
    time: '2:10 - 2:40',
    title: 'Follow-up and impact',
    screen: '/automations then /impact',
    todo: [
      'Sidebar, Follow-Up. Point at due and overdue items.',
      'Sidebar, Impact. Open one action impact record.',
      'Point at baseline vs target vs follow-up result.',
    ],
    say: [
      "Follow-ups land in one queue, due items, overdue actions, outcome reviews, so nothing relies on someone's memory. And here is the part most tools skip: Impact. We separate 'did the action happen' from 'did it improve the result'. Delivery alone proves nothing. We wait for comparable follow-up data, then show before and after.",
    ],
  },
  {
    time: '2:40 - 3:00',
    title: 'CEO close',
    screen: '/ask',
    todo: [
      'Sidebar bottom, Sign out (spinner 2.4s), choose CEO.',
      'Sidebar, Ask Work Like Moss.',
      'Click a suggested question, or type: Which division needs attention first?',
    ],
    say: [
      'During spinner: Managers get the same flow, locked to their own division.',
      'After the answer: And for the CEO: a clean dashboard, plus plain-English questions answered from the same evidence. Signal, evidence, action, follow-up, impact. That is Work Like Moss. Happy to take questions.',
    ],
  },
] as const

const cuts = [
  'Cut the AI Draft panel mention',
  'Cut Follow-Up (go Actions to Impact directly)',
  'Cut the CEO switch, say "CEO gets a dashboard and Ask" and stop',
] as const

const avoid = [
  ['AI decides what HR should do', 'AI drafts, HR decides'],
  ['Delivery proves success', 'Wait for follow-up data'],
  ['Individual employee scores or judgements', 'Group-level only'],
  ['It is real data', 'It is a synthetic dataset'],
] as const

const labelClass = 'text-xs font-semibold tracking-wide text-muted-foreground uppercase'

export function DemoNotesPage() {
  const [done, setDone] = useState<ReadonlySet<number>>(new Set())

  const toggle = (index: number): void =>
    setDone((current) => {
      const next = new Set(current)
      if (!next.delete(index)) next.add(index)
      return next
    })

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-3">
        <Badge variant="outline">Private demo notes</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">3 minute demo script</h1>
        <p className="text-sm text-muted-foreground">
          Audience: CEO, HR, Manager. Login and logout take about 2.4s, so talk through the spinner.
        </p>
        <nav aria-label="Jump to step" className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <Button key={step.title} size="sm" variant="outline" asChild>
              <a href={`#step-${index + 1}`}>{index + 1}. {step.title}</a>
            </Button>
          ))}
        </nav>
      </header>

      <section aria-labelledby="prep-title" className="space-y-3 rounded-xl border bg-card p-5">
        <h2 id="prep-title" className="text-xl font-semibold">Before you start</h2>
        <ul className="space-y-2">
          {prep.map((item, index) => (
            <li key={item}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={done.has(index)}
                  onChange={() => toggle(index)}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className={cn(done.has(index) && 'text-muted-foreground line-through')}>{item}</span>
              </label>
            </li>
          ))}
        </ul>
        <Button size="sm" asChild><Link to="/login">Open the app</Link></Button>
      </section>

      <ol className="space-y-5">
        {steps.map((step, index) => (
          <li
            key={step.title}
            id={`step-${index + 1}`}
            className="scroll-mt-4 space-y-4 rounded-xl border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{step.time}</Badge>
              <h2 className="text-xl font-semibold">{index + 1}. {step.title}</h2>
              <code className="ml-auto text-xs text-muted-foreground">{step.screen}</code>
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Do</p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                {step.todo.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Say</p>
              {step.say.map((line) => (
                <p key={line} className="border-l-2 pl-3 text-base leading-7">{line}</p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="cut-title" className="space-y-3 rounded-xl border bg-card p-5">
        <h2 id="cut-title" className="text-xl font-semibold">Running out of time? Cut in this order</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
          {cuts.map((cut) => <li key={cut}>{cut}</li>)}
        </ol>
      </section>

      <section aria-labelledby="avoid-title" className="space-y-3 rounded-xl border bg-card p-5">
        <h2 id="avoid-title" className="text-xl font-semibold">Do not say</h2>
        <ul className="space-y-2 text-sm leading-6">
          {avoid.map(([wrong, right]) => (
            <li key={wrong}>
              <span className="line-through">{wrong}</span>
              <span className="text-muted-foreground"> then say: </span>
              <span className="font-medium">{right}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
