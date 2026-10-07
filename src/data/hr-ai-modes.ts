import type { HrAiDepth, HrAiMode } from '@/types/hr-ai'

export interface HrAiModeInfo {
  key: HrAiMode
  label: string
  description: string
  purpose: string
  bestUsedWhen: readonly string[]
  focusAreas: readonly string[]
  exampleQuestions: readonly string[]
  typicalActions: readonly string[]
  willNotDo: readonly string[]
  outputStyle: string
  helper: string
}

export const HR_AI_MODES: readonly HrAiModeInfo[] = [
  {
    key: 'hr-business-partner',
    label: 'HR Business Partner',
    description: 'Balances employee experience with business impact, ownership and practical intervention.',
    purpose: 'Provides a balanced view between employee experience, business needs, ownership, feasibility and measurable outcomes.',
    bestUsedWhen: ['The issue affects a business unit or division.', 'HR needs a practical intervention.', 'Ownership and accountability matter.', 'Management wants a measurable next step.'],
    focusAreas: ['Employee experience', 'Business impact', 'Manager responsibility', 'Intervention feasibility', 'Ownership', 'Deadlines', 'Measurable outcomes'],
    exampleQuestions: ['What evidence supports this issue?', 'Who should own the intervention?', 'Is the intervention realistic?', 'How should success be measured?', 'What evidence is still missing?'],
    typicalActions: ['Manager check-ins', 'Structured career discussions', 'Process changes', 'Targeted HR review', 'Short pilot interventions'],
    willNotDo: ['Diagnose employees.', 'Make final HR decisions.', 'Automatically approve actions.', 'Judge individual performance.'],
    outputStyle: 'Evidence suggests a practical next step may be appropriate, subject to HR review and measurable follow-up.',
    helper: 'Best for balancing workforce evidence with practical business action.',
  },
  {
    key: 'employee-engagement',
    label: 'Employee Engagement',
    description: 'Focuses on engagement, belonging, manager support, motivation and employee experience signals.',
    purpose: 'Examines workforce evidence through engagement, belonging, motivation and employee-experience themes.',
    bestUsedWhen: ['Engagement scores are weak.', 'Manager support appears in feedback.', 'Belonging or career growth is mentioned.', 'Survey results need interpretation.'],
    focusAreas: ['Engagement', 'Belonging', 'Recognition', 'Manager support', 'Career growth', 'Communication', 'Employee voice', 'Role clarity'],
    exampleQuestions: ['Which engagement dimension appears weakest?', 'Is the issue repeated across multiple sources?', 'Are employees receiving enough manager support?', 'Is career progression understood?'],
    typicalActions: ['Engagement check-ins', 'Recognition improvements', 'Manager one-to-ones', 'Career-development conversations', 'Employee feedback sessions'],
    willNotDo: ['Diagnose motivation.', 'Label employees as unhappy.', 'Infer mental health.', 'Score individual employees.'],
    outputStyle: 'The available evidence may indicate an engagement theme that HR can validate with managers and teams.',
    helper: 'Best for understanding engagement, manager support and employee experience.',
  },
  {
    key: 'retention-exit',
    label: 'Retention & Exit',
    description: 'Focuses on turnover patterns, exit reasons and possible retention risks at group level.',
    purpose: 'Examines turnover, exit themes and group-level retention patterns.',
    bestUsedWhen: ['Exit numbers increase.', 'The same exit reason appears repeatedly.', 'Retention differs between divisions.', 'Survey and exit evidence appear connected.'],
    focusAreas: ['Exit patterns', 'Manager relationships', 'Career progression', 'Workload', 'Tenure', 'Role fit', 'Retention themes'],
    exampleQuestions: ['Which exit reasons occur repeatedly?', 'Do exit reasons match current pulse feedback?', 'Is the pattern concentrated within one division?', 'Is tenure associated with the pattern?'],
    typicalActions: ['Retention interviews', 'Manager reviews', 'Career-path clarification', 'Workload review', 'Targeted retention pilot'],
    willNotDo: ['Predict who will resign.', 'Create individual flight-risk scores.', 'Rank employees by retention risk.'],
    outputStyle: 'Recurring exit themes may warrant a targeted retention review, but observed reasons remain distinct from inferred causes.',
    helper: 'Best for analysing turnover and recurring exit themes.',
  },
  {
    key: 'onboarding-experience',
    label: 'Onboarding & Employee Experience',
    description: 'Focuses on new-joiner experience, access, role clarity and early employee friction.',
    purpose: 'Focuses on friction experienced by new joiners and early-stage employee experience.',
    bestUsedWhen: ['New joiners report access delays.', 'Role clarity is weak.', 'Onboarding scores decline.', 'First-month experience needs review.'],
    focusAreas: ['System access', 'Role clarity', 'Onboarding completion', 'Manager check-ins', 'Training', 'Process friction', 'Employee experience'],
    exampleQuestions: ['How long does usable system access take?', 'Do new joiners understand their role?', 'Are manager check-ins happening?', 'Is the issue operational or engagement-related?'],
    typicalActions: ['Access SLA', 'Onboarding checklist', 'Manager check-in cadence', 'Role-clarity review', 'Onboarding follow-up survey'],
    willNotDo: ['Infer employee ability.', 'Judge new-hire performance.', 'Diagnose dissatisfaction.'],
    outputStyle: 'A recurring onboarding friction point may be suitable for a practical operational fix and follow-up measurement.',
    helper: 'Best for investigating new-joiner friction and early experience.',
  },
  {
    key: 'organisational-development',
    label: 'Organisational Development',
    description: 'Focuses on team effectiveness, development, leadership, structure and organisational improvement.',
    purpose: 'Looks at longer-term team, leadership, capability and organisational improvement themes.',
    bestUsedWhen: ['Several teams show similar issues.', 'Manager capability may be involved.', 'Career development appears repeatedly.', 'The problem may be structural rather than operational.'],
    focusAreas: ['Leadership', 'Manager capability', 'Team effectiveness', 'Learning and development', 'Role design', 'Organisational structure', 'Communication', 'Change readiness'],
    exampleQuestions: ['Is this an isolated process problem or a wider capability issue?', 'Does this require manager development?', 'Is there evidence of structural friction?', 'Would a pilot intervention be enough?'],
    typicalActions: ['Manager development', 'Team workshops', 'Role redesign review', 'Learning programmes', 'Organisational pilot'],
    willNotDo: ['Recommend major restructuring from weak evidence.', 'Claim organisational causes without evidence.'],
    outputStyle: 'The pattern may point to a broader development theme, with a focused pilot preferred before wider organisational change.',
    helper: 'Best for broader leadership, team and capability issues.',
  },
] as const

export const HR_AI_DEPTHS: readonly { key: HrAiDepth; label: string; description: string }[] = [
  { key: 'quick', label: 'Quick', description: 'Short summary with focused investigation areas and actions.' },
  { key: 'standard', label: 'Standard', description: 'Balanced evidence interpretation for normal review.' },
  { key: 'deep', label: 'Deep', description: 'More comparison, limitations, questions and detail.' },
] as const

export const HR_AI_FOCUS_AREAS = [
  'Manager Support', 'Career Growth', 'Engagement', 'Retention', 'Onboarding',
  'Role Clarity', 'Team Belonging', 'Practical Actions', '30-Day Pilot', '60-Day Pilot',
] as const

export const DEFAULT_HR_AI_MODE: HrAiMode = 'hr-business-partner'
export const DEFAULT_HR_AI_DEPTH: HrAiDepth = 'standard'

export function getHrAiModeLabel(mode: HrAiMode): string {
  return HR_AI_MODES.find((entry) => entry.key === mode)?.label ?? 'HR Business Partner'
}
