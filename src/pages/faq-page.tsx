import { ArrowRight, ChevronDown, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'

type FaqQuestion = {
  id: string
  question: string
  answer: string
  keywords: string[]
  mentor?: boolean
}

type FaqCategory = {
  id: string
  title: string
  description: string
  questions: FaqQuestion[]
}

const faqCategories: FaqCategory[] = [
  {
    id: 'project',
    title: 'Project & MVP',
    description: 'What Work Like Moss is, why it exists, and what the MVP covers.',
    questions: [
      { id: 'project-1', question: 'What is Work Like Moss?', answer: 'Work Like Moss is an HR intelligence and action-management MVP. It helps management identify workforce signals, review supporting evidence, create accountable HR actions, follow up on delivery, and compare later results.', keywords: ['project', 'purpose', 'mvp'] },
      { id: 'project-2', question: 'What problem are we trying to solve?', answer: 'The main problem is not a lack of HR data. The problem is turning available employee data into something management can understand and act on. Survey, onboarding, exit and action information may exist, but it can be difficult to see which issue matters, why it matters, who owns the next action and whether the action later improved the situation.', keywords: ['problem', 'hr', 'data'] },
      { id: 'project-3', question: 'What is the main workflow of the MVP?', answer: 'The core workflow is Data → Detect → Explain → Prioritise → Act → Follow Up → Measure. The system first identifies a group-level workforce signal, shows the supporting evidence, helps HR decide what action to take, tracks the action and later compares the outcome.', keywords: ['workflow', 'detect', 'measure'] },
      { id: 'project-4', question: 'Who is the main user of the system?', answer: 'The main intended users are HR and management users who need to understand workforce issues and manage interventions. The MVP is not designed as an employee self-service portal.', keywords: ['user', 'hr', 'management'] },
      { id: 'project-5', question: 'Is this a complete HR management system?', answer: 'No. This is an MVP focused specifically on the signal-to-action workflow. It does not attempt to replace a complete HRIS, payroll, leave-management or recruitment platform.', keywords: ['scope', 'hris', 'limitations'] },
    ],
  },
  {
    id: 'data',
    title: 'Data Sources',
    description: 'Where the MVP data comes from and what information is used.',
    questions: [
      { id: 'data-1', question: 'Where does the data in the current MVP come from?', answer: 'The current prototype loads the provided HR dataset from a bundled Excel workbook. The workbook is used as the demonstration data source for the MVP rather than a live production HR database.', keywords: ['excel', 'workbook', 'source'], mentor: true },
      { id: 'data-2', question: 'What types of HR data are used?', answer: 'The current project uses available employee records, pulse survey data, onboarding survey data, exit information and action-tracker data. These sources are used together where relevant to provide better context for a workforce signal.', keywords: ['pulse', 'onboarding', 'exit', 'employee'] },
      { id: 'data-3', question: 'Why do we use more than one data source?', answer: 'A single score or comment may not be enough to justify HR action. Using several relevant sources helps HR see whether different evidence points toward the same issue. This reduces the risk of acting on one isolated response.', keywords: ['evidence', 'multiple sources', 'validation'] },
      { id: 'data-4', question: 'Does the current MVP use live company data?', answer: 'No. The current version is a prototype using the bundled demonstration dataset. A production version would require secure integration with authorised HR data sources and proper backend access controls.', keywords: ['live data', 'prototype', 'production'] },
      { id: 'data-5', question: 'Does the system modify the original HR source data?', answer: 'The analytics layer reads and processes the source data for the prototype. Workflow states such as reviewed actions and follow-up states are handled separately. The MVP is not designed to overwrite the original workbook source records.', keywords: ['source data', 'modify', 'workbook'] },
    ],
  },
  {
    id: 'processing',
    title: 'Data Processing & Signals',
    description: 'How raw HR information becomes a workforce signal.',
    questions: [
      { id: 'processing-1', question: 'How is the HR data processed?', answer: 'The workbook data is loaded into the application and transformed into structured analytics. Existing TypeScript services calculate metrics, group results, compare relevant groups with company benchmarks and generate workforce insights.', keywords: ['processing', 'typescript', 'analytics'], mentor: true },
      { id: 'processing-2', question: 'How does the system decide that something needs attention?', answer: 'The signal-detection logic looks for unusual group-level patterns such as results below a company benchmark, recurring onboarding problems, exit patterns or other supported differences. The exact logic depends on the metric being analysed.', keywords: ['signal', 'detection', 'benchmark'], mentor: true },
      { id: 'processing-3', question: 'Does AI decide whether a signal exists?', answer: 'No. Core signal detection, benchmark calculation, privacy eligibility, priority and outcome measurement remain deterministic. AI may assist with drafting explanations or recommendations, but it does not decide whether the underlying signal exists.', keywords: ['ai', 'signal', 'deterministic'], mentor: true },
      { id: 'processing-4', question: 'How is the company benchmark used?', answer: 'Where a relevant benchmark exists, the affected group can be compared against the company-level result. This gives HR context. A value is not presented alone; HR can see how it differs from the wider organisation.', keywords: ['benchmark', 'comparison', 'company'] },
      { id: 'processing-5', question: 'What happens when the available evidence is weak?', answer: 'The system does not treat weak evidence as a confirmed cause. It may show limited evidence, a weaker signal, or suggest that HR validate the issue before choosing a targeted intervention. The wording deliberately distinguishes evidence from hypothesis.', keywords: ['weak evidence', 'confidence', 'hypothesis'] },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Governance',
    description: 'How the MVP avoids unsafe individual-level HR conclusions.',
    questions: [
      { id: 'privacy-1', question: 'Does the system score individual employees?', answer: 'No. The MVP is designed around group-level workforce analytics. It does not create individual engagement, dissatisfaction, performance or attrition-risk scores for HR decision-making.', keywords: ['privacy', 'individual', 'scoring'], mentor: true },
      { id: 'privacy-2', question: 'How are small groups protected?', answer: "Detailed group analytics are suppressed when there are fewer than five valid responses. Instead of showing detailed values, the interface displays a privacy-safe message such as 'Insufficient responses'.", keywords: ['small groups', '5 responses', 'suppression'] },
      { id: 'privacy-3', question: 'Why was five responses chosen?', answer: 'Five responses is the minimum group-detail privacy rule used by this MVP. It provides a clear prototype safeguard so detailed analytics are not shown for very small groups. In a production deployment, the organisation should validate the final threshold against its HR, privacy and legal policies.', keywords: ['threshold', 'five', 'privacy'], mentor: true },
      { id: 'privacy-4', question: 'Are employee comments displayed directly?', answer: 'The MVP prefers aggregated themes rather than identifiable raw comments. The goal is to identify patterns such as career growth or manager support without exposing unnecessary employee-identifiable feedback.', keywords: ['comments', 'themes', 'anonymous'] },
      { id: 'privacy-5', question: 'Can AI bypass the privacy rules?', answer: 'No. AI-assisted analysis must receive only privacy-safe structured evidence. If a group does not meet the minimum privacy requirement, AI analysis should not be called for that detailed group signal.', keywords: ['ai', 'privacy gate', 'sanitise'] },
    ],
  },
  {
    id: 'actions',
    title: 'Actions & Measurement',
    description: 'How HR turns a signal into an accountable action and measures the result.',
    questions: [
      { id: 'actions-1', question: 'Does the system automatically take HR action?', answer: 'No. Recommendations require human review. HR can review, edit, approve or reject a proposed action. The system assists the decision process but does not replace the HR decision-maker.', keywords: ['approve', 'human', 'decision'] },
      { id: 'actions-2', question: 'What information is required before an action is approved?', answer: 'Approved actions require clear ownership and measurement information. The existing MVP supports an owner, deadline, baseline and success measure. Numeric actions require a target, while a qualitative or diagnostic action requires an explicit reason when a numeric target is not appropriate.', keywords: ['owner', 'deadline', 'baseline', 'target'] },
      { id: 'actions-3', question: 'How do we know whether the action was actually delivered?', answer: 'Action tracking stores delivery information at group level, including delivery status, affected group, intended audience, reached audience, coverage and delivery details where applicable.', keywords: ['delivery', 'coverage', 'tracking'] },
      { id: 'actions-4', question: 'If an action is completed, does that mean it was successful?', answer: 'No. Delivery and outcome are deliberately separated. Completing an intervention only confirms that it happened. The system waits for comparable follow-up evidence before judging whether the relevant workforce result improved.', keywords: ['outcome', 'success', 'delivery'] },
      { id: 'actions-5', question: 'How is improvement measured?', answer: 'Where comparable data is available, the Impact flow compares the baseline, target and later measurement. If suitable follow-up data is not yet available, the system shows that the outcome is not measurable yet instead of claiming success.', keywords: ['impact', 'baseline', 'follow-up'] },
    ],
  },
  {
    id: 'technical',
    title: 'Technical Design & Limitations',
    description: 'Current architecture, AI design, storage and production limitations.',
    questions: [
      { id: 'technical-1', question: 'What technology is currently doing the analytics?', answer: 'The current prototype performs its HR analytics through frontend TypeScript services. These services load and transform the workbook data, calculate metrics, detect supported signals and prepare evidence for the interface.', keywords: ['typescript', 'frontend', 'analytics'] },
      { id: 'technical-2', question: 'Where are approved actions and demo workflow states stored?', answer: 'The current MVP uses browser localStorage for demo workflow state such as action reviews and related prototype state. This makes the demo usable without a full backend, but it is not intended as production persistence.', keywords: ['localStorage', 'storage', 'actions'] },
      { id: 'technical-3', question: 'Why is there no full backend yet?', answer: 'The project is an MVP focused on validating the HR signal-to-action workflow. A production version would require a backend database, authentication, authorisation, multi-user audit history and secure organisational integrations.', keywords: ['backend', 'mvp', 'production'], mentor: true },
      { id: 'technical-4', question: 'What role does AI play in the system?', answer: 'AI is limited to assistance such as summarising evidence, drafting possible explanations, suggesting investigation areas and preparing possible actions. It must use the available evidence and remain subject to HR review. It is not responsible for signal detection, privacy decisions, approval or outcome measurement.', keywords: ['ai', 'draft', 'hr review'] },
      { id: 'technical-5', question: 'What would need to change before using this in production?', answer: 'A production version would need secure backend persistence, authentication and role-based authorisation, server-side audit history, secure HR data integrations, validated organisation-specific thresholds, stronger operational monitoring and formal privacy/governance review.', keywords: ['production', 'security', 'limitations'], mentor: true },
    ],
  },
]

function FaqItem({ item }: { item: FaqQuestion }) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium transition-colors hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span>{item.question}</span>
          {item.mentor ? <Badge variant="secondary" className="shrink-0 text-[10px]">Likely Mentor Question</Badge> : null}
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-4 pr-8 text-sm leading-6 text-muted-foreground">
        {item.answer}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function FaqPage() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCategories = useMemo(() => faqCategories.map((category) => ({
    ...category,
    questions: category.questions.filter((item) => {
      if (!normalizedQuery) return true
      return [item.question, item.answer, ...item.keywords].join(' ').toLowerCase().includes(normalizedQuery)
    }),
  })).filter((category) => category.questions.length > 0), [normalizedQuery])
  const totalQuestions = faqCategories.reduce((total, category) => total + category.questions.length, 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <section className="rounded-xl border bg-card p-6 sm:p-8">
        <div className="space-y-4">
          <Badge variant="outline">{totalQuestions} Questions · {faqCategories.length} Categories</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">FAQ &amp; Mentor Questions</h1>
            <p className="text-lg font-medium text-muted-foreground">Common questions about our data, processing, signal detection, privacy, HR actions, AI assistance, and MVP limitations.</p>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">This page explains how Work Like Moss works and prepares the team for questions that may arise during the project demonstration.</p>
        </div>
      </section>

      <section className="sticky top-3 z-10 space-y-3 rounded-lg border bg-background/95 p-3 backdrop-blur" aria-label="FAQ controls">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions..." aria-label="Search FAQ questions" className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {faqCategories.map((category) => <a key={category.id} href={`#${category.id}`} className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{category.title}</a>)}
        </div>
      </section>

      {filteredCategories.length > 0 ? <div className="space-y-6">{filteredCategories.map((category) => <section key={category.id} id={category.id} className="scroll-mt-28 space-y-3" aria-labelledby={`${category.id}-title`}><div className="space-y-1"><h2 id={`${category.id}-title`} className="text-xl font-semibold tracking-tight">{category.title}</h2><p className="text-sm text-muted-foreground">{category.description}</p></div><Card><CardContent className="pt-2">{category.questions.map((item) => <FaqItem key={item.id} item={item} />)}</CardContent></Card></section>)}</div> : <Card><CardHeader><CardTitle>No questions found</CardTitle><CardDescription>Try a different keyword or clear the search.</CardDescription></CardHeader></Card>}

      <section className="rounded-xl border bg-card p-6 sm:p-8" aria-labelledby="faq-footer-title">
        <div className="space-y-4"><div><h2 id="faq-footer-title" className="text-xl font-semibold tracking-tight">Still preparing for the demo?</h2><p className="mt-1 text-sm text-muted-foreground">Use the runbook or open the main product flows directly.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/demo-guide">Open Demo Guide<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button><Button variant="outline" asChild><Link to="/">Open Overview<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button><Button variant="outline" asChild><Link to="/actions">Open Actions<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button><Button variant="outline" asChild><Link to="/impact">Open Impact<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button></div></div>
      </section>
    </div>
  )
}
