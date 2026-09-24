import type { TargetDirection } from '@/data/hr-action-targets'
import type { EvidenceTheme } from '@/types/hr-analytics'
import type {
  ActionExecutionStatus,
  RecommendationDriverKey,
  RecommendedActionStatus,
} from '@/types/hr-actions'
import type { DriverCategory, InsightScope, InsightScopeKind } from '@/types/hr-insights'

/**
 * Developer note — the intervention catalogue
 *
 * Every recommendation the system can make is written down here, in plain
 * language, so a reviewer can read exactly what the engine is allowed to
 * suggest. The engine picks a template; it never composes an intervention.
 *
 * Two rules hold:
 *  1. Every template names a concrete activity with an owner and a measure.
 *     "Improve culture" is not an action and is not in this file.
 *  2. Nothing here changes pay, status, or standing. Interventions are about
 *     employee experience and retention only, and a human approves each one.
 */

export interface ActionTemplate {
  title: string
  description: string
  /**
   * Used when the intervention has a baseline it can actually move. `{scope}` is
   * replaced with a readable phrase for the affected group.
   */
  successMeasureTemplate: string
  /**
   * Used when no re-measurable baseline exists — an exit-survey score cannot be
   * measured again, because those people have left. Success is then defined by
   * the work being done, never by a number the data cannot support.
   */
  operationalSuccessMeasure: string
  /** Which way the baseline metric has to move for this to have worked. */
  targetDirection: TargetDirection
  /**
   * Overrides the priority-based timeline where the intervention has its own
   * natural window — access problems cannot wait for a 90-day cycle.
   */
  durationDays?: number
  /** Restricts a template to the scopes where the measure genuinely applies. */
  appliesToScopes?: readonly InsightScopeKind[]
}

export interface DriverActionTemplate extends ActionTemplate {
  driverCategory: DriverCategory
}

/**
 * One intervention per driver, except where a scope genuinely needs a different
 * one — scope-restricted templates are listed first so they win the lookup.
 * Listing five near-identical variants would only produce noise for HR.
 */
export const ACTION_CATALOG: readonly DriverActionTemplate[] = [
  {
    driverCategory: 'manager-support',
    appliesToScopes: ['new-joiners', 'tenure-band'],
    title: 'Introduce structured 30 / 60 / 90-day manager check-ins',
    description:
      'Create scheduled manager conversations during the first 90 days to review role clarity, support needs and employee experience.',
    successMeasureTemplate:
      'Increase {scope} Manager Support score in the next pulse survey.',
    operationalSuccessMeasure:
      'Hold the 30, 60 and 90-day check-in with every affected {scope} employee before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'manager-support',
    title: 'Establish a documented manager one-to-one cadence',
    description:
      'Agree a fortnightly one-to-one rhythm for every people manager in scope, with a shared agenda covering priorities, blockers and the support each employee needs.',
    successMeasureTemplate:
      'Increase {scope} Manager Support score in the next pulse survey.',
    operationalSuccessMeasure:
      'Agree and run the one-to-one cadence with every people manager in scope before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'role-clarity',
    title: 'Run a 30-day role clarity review',
    description:
      'Review role expectations with new joiners during their first month and confirm priorities, responsibilities and escalation channels in writing.',
    successMeasureTemplate:
      'Increase {scope} Role Clarity score in the next onboarding measurement.',
    operationalSuccessMeasure:
      'Complete a documented role expectation review with every affected {scope} employee before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'career-growth',
    title: 'Introduce structured career development conversations',
    description:
      'Hold a documented development conversation with every employee in scope to clarify progression opportunities, skills gaps and realistic next steps.',
    successMeasureTemplate: 'Increase {scope} Career Growth score in the next pulse wave.',
    operationalSuccessMeasure:
      'Complete a documented development conversation with every affected {scope} employee before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'workload',
    title: 'Run a workload and capacity review',
    description:
      'Review how work is distributed across the affected group, identify where it concentrates, and rebalance commitments before considering any structural change.',
    successMeasureTemplate:
      'Reduce reported workload pressure for {scope} in the next pulse wave.',
    operationalSuccessMeasure:
      'Complete the workload review for {scope} and record the agreed rebalancing before the due date.',
    targetDirection: 'decrease',
  },
  {
    driverCategory: 'belonging',
    title: 'Run a team connection session and pair a peer buddy',
    description:
      'Schedule a team integration session for the affected group and pair each newer employee with a named peer buddy for their first three months.',
    successMeasureTemplate: 'Increase {scope} Belonging score in the next pulse survey.',
    operationalSuccessMeasure:
      'Run the team connection session and confirm a named buddy for every newer {scope} employee before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'tools-access',
    durationDays: 30,
    title: 'Implement a day-one access checklist',
    description:
      'Ensure systems, equipment and required access are available before or immediately after the employee joins, with a named owner signing off each item.',
    successMeasureTemplate:
      'Increase {scope} Tools Access score in the next onboarding measurement.',
    operationalSuccessMeasure:
      'Confirm signed-off access, equipment and systems for every new {scope} joiner before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'onboarding',
    title: 'Standardise the 30 / 60 / 90-day onboarding milestones',
    description:
      'Define one onboarding milestone checklist covering manager contact, role expectations and system access, and confirm completion at each stage for the affected group.',
    successMeasureTemplate:
      'Increase {scope} overall onboarding score in the next onboarding measurement.',
    operationalSuccessMeasure:
      'Publish the onboarding milestone checklist and confirm completion for every affected {scope} joiner before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'employee-experience',
    title: 'Run a structured employee experience review',
    description:
      'Review the experience factors reported by the affected group across onboarding, pulse and exit responses, then agree the single strongest factor to address.',
    successMeasureTemplate:
      'Complete the experience review for {scope} and record the agreed intervention before the due date.',
    operationalSuccessMeasure:
      'Complete the experience review for {scope} and record the agreed intervention before the due date.',
    targetDirection: 'increase',
  },
  {
    driverCategory: 'retention',
    title: 'Conduct a structured retention review',
    description:
      'Conduct a structured HR review of the affected employee group and validate the strongest experience factors before implementing a targeted intervention.',
    successMeasureTemplate:
      'Complete the retention review for {scope} and agree a targeted intervention before the due date.',
    operationalSuccessMeasure:
      'Complete the retention review for {scope} and agree a targeted intervention before the due date.',
    targetDirection: 'decrease',
  },
]

/**
 * The no-driver case. When the likely-driver engine reports no strong
 * contributing driver, the responsible recommendation is to find out — not to
 * guess an intervention and call it evidence-based.
 */
export const DIAGNOSTIC_ACTION_TEMPLATE: ActionTemplate = {
  title: 'Review and validate the group-level issue',
  description:
    'Review the available evidence with the relevant HR and business owner, check the affected group’s experience, and agree whether a targeted intervention is warranted.',
  successMeasureTemplate:
    'Complete the {scope} evidence review and record the validated issue before the due date.',
  operationalSuccessMeasure:
    'Complete the {scope} evidence review and record the validated issue before the due date.',
  targetDirection: 'increase',
}

export const DIAGNOSTIC_DRIVER_LABEL = 'No strong driver identified'

/** Only measured themes with a genuinely corresponding intervention are mapped. */
export const EVIDENCE_THEME_DRIVER_MAP: Partial<Record<EvidenceTheme, DriverCategory>> = {
  managerSupport: 'manager-support',
  careerGrowth: 'career-growth',
  roleClarity: 'role-clarity',
  workload: 'workload',
  exitWorkload: 'workload',
  belonging: 'belonging',
  toolsAccess: 'tools-access',
  onboardingOverall: 'onboarding',
}

/**
 * The single place a driver is mapped to a suggested owner. These are ROLE
 * suggestions for a prototype, never real employee identities, and HR can
 * change any of them at review time.
 */
export const DRIVER_OWNER_MAP = {
  'manager-support': 'HR Business Partner',
  'role-clarity': 'People Manager',
  'career-growth': 'HR Business Partner',
  workload: 'Division Manager',
  belonging: 'People Manager',
  'tools-access': 'HR Operations',
  onboarding: 'HR Business Partner',
  'employee-experience': 'HR Business Partner',
  retention: 'HR Business Partner',
} as const satisfies Record<DriverCategory, string>

export const DIAGNOSTIC_OWNER_ROLE = 'HR Business Partner'

/** The roles HR can pick from in the review panel. */
export const OWNER_ROLE_OPTIONS = [
  'HR Business Partner',
  'People Manager',
  'Division Manager',
  'Learning & Development',
  'HR Operations',
] as const

/** Central functions are not division-scoped; these three are. */
const DIVISION_SCOPED_ROLES: readonly string[] = [
  'HR Business Partner',
  'People Manager',
  'Division Manager',
]

/**
 * Suggests a role, narrowed to the division when the issue is division-scoped
 * (e.g. "Sales HR Business Partner"). Still a role, not a person.
 */
export function suggestOwnerRole(driver: RecommendationDriverKey, scope: InsightScope): string {
  const role = driver === 'diagnostic' ? DIAGNOSTIC_OWNER_ROLE : DRIVER_OWNER_MAP[driver]
  if (scope.kind !== 'division' || !scope.key || !DIVISION_SCOPED_ROLES.includes(role)) return role
  /* An "HR" division would otherwise produce "HR HR Business Partner". */
  if (role.toLowerCase().startsWith(scope.key.toLowerCase())) return role
  return `${scope.key} ${role}`
}

/**
 * The first template whose driver matches and whose scope restriction allows
 * this scope. `null` means the catalogue has nothing for that driver, and the
 * engine falls back to the diagnostic action.
 */
export function findActionTemplate(
  driver: DriverCategory,
  scopeKind: InsightScopeKind,
): DriverActionTemplate | null {
  return (
    ACTION_CATALOG.find(
      (template) =>
        template.driverCategory === driver &&
        (!template.appliesToScopes || template.appliesToScopes.includes(scopeKind)),
    ) ?? null
  )
}

/** A readable phrase for the affected group, for use inside a sentence. */
export function scopePhrase(scope: InsightScope): string {
  if (scope.kind === 'company') return 'company-wide'
  if (scope.kind === 'new-joiners') return 'new joiner'
  if (scope.kind === 'division' && scope.key) return `${scope.key} division`
  if (scope.kind === 'tenure-band' && scope.key) return `${scope.key} tenure`
  return scope.label
}

/* ------------------------------------------------------- status vocabulary */

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendedActionStatus, string> = {
  'pending-review': 'Suggested',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const ACTION_STATUS_LABELS: Record<ActionExecutionStatus, string> = {
  planned: 'Approved',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** Optional rejection reasons, offered as a shortcut rather than free text. */
export const REJECTION_REASONS = [
  'Already addressed',
  'Insufficient evidence',
  'Not feasible now',
  'Alternative intervention preferred',
] as const
