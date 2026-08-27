import {
  isValidBaseEngagement,
  isValidScore,
  isValidTenure,
  SCORE_SCALE,
} from '@/data/hr-analytics.constants'
import type { DataQualityReport } from '@/types/hr-analytics'
import type { ActionRecord, HrDataset } from '@/types/hr-data'
import { countWhere } from '@/utils/analytics'

/**
 * Structural checks that run before any metric is calculated.
 *
 * `errors` are problems that make a number wrong (missing or duplicated
 * identities, surveys pointing at employees that do not exist). `warnings` are
 * problems the analytics layer can work around by excluding rows — they are
 * still reported rather than swallowed.
 */

type SurveyCollection = {
  label: string
  ids: readonly string[]
}

/** One 1–5 score column, named as it appears in the workbook. */
type ScoreCheck = {
  sheet: string
  column: string
  values: readonly number[]
}

const REQUIRED_ACTION_FIELDS = [
  'actionId',
  'scope',
  'theme',
  'issue',
  'action',
  'owner',
] as const satisfies readonly (keyof ActionRecord)[]

const SHEET_LABELS = {
  onboardingSurveys: 'Onboarding_Survey',
  pulseSurveys: 'Pulse_Survey',
  exitSurveys: 'Exit_Survey',
} as const

export function validateHrDataset(dataset: HrDataset): DataQualityReport {
  const errors: string[] = []
  const warnings: string[] = []

  const { employees, onboardingSurveys, pulseSurveys, exitSurveys, actions } = dataset

  /* identity ------------------------------------------------------------- */

  const missingIds = countWhere(employees, (employee) => employee.employeeId.trim() === '')
  if (missingIds > 0) {
    errors.push(`Employees: ${missingIds} row(s) have no employee_id.`)
  }

  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const employee of employees) {
    const id = employee.employeeId
    if (id === '') continue
    if (seen.has(id)) duplicates.add(id)
    else seen.add(id)
  }
  if (duplicates.size > 0) {
    errors.push(
      `Employees: ${duplicates.size} duplicate employee_id value(s) — e.g. ${[...duplicates]
        .slice(0, 3)
        .join(', ')}.`,
    )
  }

  /* survey references ---------------------------------------------------- */

  const surveys: readonly SurveyCollection[] = [
    { label: SHEET_LABELS.onboardingSurveys, ids: onboardingSurveys.map((row) => row.employeeId) },
    { label: SHEET_LABELS.pulseSurveys, ids: pulseSurveys.map((row) => row.employeeId) },
    { label: SHEET_LABELS.exitSurveys, ids: exitSurveys.map((row) => row.employeeId) },
  ]

  for (const { label, ids } of surveys) {
    const orphans = ids.filter((id) => id === '' || !seen.has(id))
    if (orphans.length > 0) {
      errors.push(`${label}: ${orphans.length} response(s) reference an unknown employee_id.`)
    }
  }

  /* numeric ranges ------------------------------------------------------- */

  const scoreChecks: readonly ScoreCheck[] = [
    { sheet: 'Onboarding_Survey', column: 'overall_score', values: onboardingSurveys.map((r) => r.overallScore) },
    { sheet: 'Onboarding_Survey', column: 'manager_support', values: onboardingSurveys.map((r) => r.managerSupport) },
    { sheet: 'Onboarding_Survey', column: 'role_clarity', values: onboardingSurveys.map((r) => r.roleClarity) },
    { sheet: 'Onboarding_Survey', column: 'tools_access', values: onboardingSurveys.map((r) => r.toolsAccess) },
    { sheet: 'Pulse_Survey', column: 'engagement_score', values: pulseSurveys.map((r) => r.engagementScore) },
    { sheet: 'Pulse_Survey', column: 'manager_support', values: pulseSurveys.map((r) => r.managerSupport) },
    { sheet: 'Pulse_Survey', column: 'workload', values: pulseSurveys.map((r) => r.workload) },
    { sheet: 'Pulse_Survey', column: 'career_growth', values: pulseSurveys.map((r) => r.careerGrowth) },
    { sheet: 'Pulse_Survey', column: 'belonging', values: pulseSurveys.map((r) => r.belonging) },
    { sheet: 'Exit_Survey', column: 'Overall_Experience', values: exitSurveys.map((r) => r.overallExperience) },
    { sheet: 'Exit_Survey', column: 'Manager_Support', values: exitSurveys.map((r) => r.managerSupport) },
    { sheet: 'Exit_Survey', column: 'Career_Opportunity', values: exitSurveys.map((r) => r.careerOpportunity) },
    { sheet: 'Exit_Survey', column: 'Workload', values: exitSurveys.map((r) => r.workload) },
  ]

  for (const { sheet, column, values } of scoreChecks) {
    const invalid = countWhere(values, (value) => !isValidScore(value))
    if (invalid > 0) {
      warnings.push(
        `${sheet}.${column}: ${invalid} value(s) outside the ${SCORE_SCALE.min}–${SCORE_SCALE.max} scale were excluded from averages.`,
      )
    }
  }

  const invalidTenure = countWhere(employees, (employee) => !isValidTenure(employee.tenureMonths))
  if (invalidTenure > 0) {
    warnings.push(
      `Employees.tenure_months: ${invalidTenure} value(s) are not a usable tenure — excluded from tenure bands and new joiner metrics.`,
    )
  }

  const invalidEngagement = countWhere(
    employees,
    (employee) => !isValidBaseEngagement(employee.baseEngagement),
  )
  if (invalidEngagement > 0) {
    warnings.push(
      `Employees.base_engagement: ${invalidEngagement} value(s) fall outside 0–1 and were excluded from averages.`,
    )
  }

  /* categorical completeness --------------------------------------------- */

  const CATEGORICAL_FIELDS = ['division', 'employeeGroup', 'location'] as const
  for (const field of CATEGORICAL_FIELDS) {
    const blank = countWhere(employees, (employee) => employee[field].trim() === '')
    if (blank > 0) {
      warnings.push(
        `Employees.${field}: ${blank} row(s) are blank and are excluded from that breakdown.`,
      )
    }
  }

  /* exit consistency ----------------------------------------------------- */

  const leaversWithoutDate = countWhere(
    employees,
    (employee) => employee.exitStatus === 'Leaver' && employee.exitDate === null,
  )
  if (leaversWithoutDate > 0) {
    warnings.push(`Employees: ${leaversWithoutDate} leaver(s) have no exit_date.`)
  }

  const leaversWithoutReason = countWhere(
    employees,
    (employee) => employee.exitStatus === 'Leaver' && employee.exitReason === null,
  )
  if (leaversWithoutReason > 0) {
    warnings.push(`Employees: ${leaversWithoutReason} leaver(s) have no exit_reason.`)
  }

  const activeWithExitDate = countWhere(
    employees,
    (employee) => employee.exitStatus === 'Active' && employee.exitDate !== null,
  )
  if (activeWithExitDate > 0) {
    warnings.push(`Employees: ${activeWithExitDate} active employee(s) carry an exit_date.`)
  }

  const statusById = new Map(employees.map((employee) => [employee.employeeId, employee.exitStatus]))
  const exitSurveysForActive = countWhere(
    exitSurveys,
    (survey) => statusById.get(survey.employeeId) === 'Active',
  )
  if (exitSurveysForActive > 0) {
    warnings.push(
      `Exit_Survey: ${exitSurveysForActive} response(s) belong to an employee still marked Active.`,
    )
  }

  /* actions -------------------------------------------------------------- */

  for (const field of REQUIRED_ACTION_FIELDS) {
    const missing = countWhere(actions, (action) => action[field].trim() === '')
    if (missing > 0) {
      warnings.push(`Action_Tracker.${field}: ${missing} row(s) are empty.`)
    }
  }

  /* dataset summary cross-check ----------------------------------------- */

  const summaryChecks: readonly { keyword: string; actual: number }[] = [
    { keyword: 'active', actual: countWhere(employees, (e) => e.exitStatus === 'Active') },
    { keyword: 'leaver', actual: countWhere(employees, (e) => e.exitStatus === 'Leaver') },
  ]

  for (const { keyword, actual } of summaryChecks) {
    const entry = dataset.datasetSummary.find((item) =>
      item.metric.toLowerCase().includes(keyword),
    )
    if (entry && entry.value !== actual) {
      errors.push(
        `Dataset_Summary "${entry.metric}" reports ${entry.value} but analytics counted ${actual}.`,
      )
    }
  }

  return { valid: errors.length === 0, warnings, errors }
}
