import {
  isValidBaseEngagement,
  isValidScore,
  isValidTenure,
  SCORE_SCALE,
} from '@/data/hr-analytics.constants'
import { ACTION_STATUSES, WOULD_RECOMMEND_VALUES, getEmployeeExitStatus } from '@/data/hr-data.constants'
import type { DataQualityReport } from '@/types/hr-analytics'
import type { ActionRecord, HrDataset } from '@/types/hr-data'
import { countWhere, isFiniteNumber } from '@/utils/analytics'

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
  values: readonly (number | null)[]
}

const REQUIRED_ACTION_FIELDS = [
  'actionId',
  'scope',
  'theme',
  'issue',
  'action',
  'owner',
  'startDate',
  'status',
  'successMeasure',
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

  function checkRequired<T>(label: string, rows: readonly T[], fields: readonly (keyof T)[]): void {
    for (const field of fields) {
      const missing = countWhere(rows, (row) => row[field] == null || String(row[field]).trim() === '')
      if (missing > 0) warnings.push(`${label}.${String(field)}: ${missing} row(s) are missing a required field.`)
    }
  }

  checkRequired('Employees', employees, ['joinDate'])
  checkRequired('Onboarding_Survey', onboardingSurveys, ['division', 'employeeGroup', 'joinDate', 'surveyDate'])
  checkRequired('Pulse_Survey', pulseSurveys, ['surveyWave', 'surveyDate'])
  checkRequired('Exit_Survey', exitSurveys, ['exitDate', 'primaryExitReason'])
  checkRequired('Data_Dictionary', dataset.dataDictionary, ['table', 'field', 'description', 'type'])
  checkRequired('Dataset_Summary', dataset.datasetSummary, ['metric'])

  const unknownStatuses = countWhere(employees, (row) => getEmployeeExitStatus(row.exitStatus) === null)
  if (unknownStatuses > 0) {
    errors.push(`Employees: ${unknownStatuses} missing or unknown exit_status value(s); Active + Leaver does not equal totalEmployees. Source statuses are unchanged.`)
  }

  const categoryChecks = [
    { label: 'Action_Tracker.Status', values: actions.map((row) => row.status), allowed: ACTION_STATUSES },
    { label: 'Exit_Survey.Would_Recommend', values: exitSurveys.map((row) => row.wouldRecommend), allowed: WOULD_RECOMMEND_VALUES },
  ]
  for (const { label, values, allowed } of categoryChecks) {
    const invalid = countWhere(values, (value) => !allowed.some((option) => option === value))
    if (invalid > 0) errors.push(`${label}: ${invalid} missing or unknown value(s); source values are unchanged.`)
  }

  /* identity ------------------------------------------------------------- */

  const missingIds = countWhere(employees, (employee) => employee.employeeId.trim() === '')
  if (missingIds > 0) {
    errors.push(`Employees: ${missingIds} row(s) have no employee_id.`)
  }

  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const employee of employees) {
    const id = employee.employeeId
    if (id.trim() === '') continue
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
    const missing = countWhere(ids, (id) => id.trim() === '')
    if (missing > 0) errors.push(`${label}: ${missing} response(s) have no employee_id.`)
    const orphans = ids.filter((id) => id.trim() !== '' && !seen.has(id))
    if (orphans.length > 0) {
      errors.push(`${label}: ${orphans.length} response(s) reference an unknown employee_id.`)
    }
  }

  const pulseIdsByWave = new Map<string, Set<string>>()
  let duplicatePulseResponses = 0
  for (const row of pulseSurveys) {
    if (row.surveyWave.trim() === '' || row.employeeId.trim() === '') continue
    let ids = pulseIdsByWave.get(row.surveyWave)
    if (!ids) {
      ids = new Set<string>()
      pulseIdsByWave.set(row.surveyWave, ids)
    }
    if (ids.has(row.employeeId)) duplicatePulseResponses += 1
    else ids.add(row.employeeId)
  }
  if (duplicatePulseResponses > 0) {
    warnings.push(`Pulse_Survey: ${duplicatePulseResponses} additional response(s) share an employee_id and survey_wave. All source rows remain included; review duplicates before interpreting pulse averages.`)
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
        `${sheet}.${column}: ${invalid} missing, non-numeric or out-of-range value(s) were excluded from averages (${SCORE_SCALE.min}–${SCORE_SCALE.max} scale).`,
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
      `Employees.base_engagement: ${invalidEngagement} missing, non-numeric or out-of-range value(s) were excluded from averages (0–1 scale).`,
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
    (employee) => getEmployeeExitStatus(employee.exitStatus) === 'Leaver' && employee.exitDate === null,
  )
  if (leaversWithoutDate > 0) {
    warnings.push(`Employees: ${leaversWithoutDate} leaver(s) have no exit_date.`)
  }

  const leaversWithoutReason = countWhere(
    employees,
    (employee) => getEmployeeExitStatus(employee.exitStatus) === 'Leaver' && employee.exitReason === null,
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
  const employeeById = new Map(employees.map((employee) => [employee.employeeId, employee]))
  const onboardingGroupDifferences = countWhere(onboardingSurveys, (survey) => {
    const employee = employeeById.get(survey.employeeId)
    return employee !== undefined &&
      (survey.division !== employee.division || survey.employeeGroup !== employee.employeeGroup)
  })
  if (onboardingGroupDifferences > 0) {
    warnings.push(`Onboarding_Survey: ${onboardingGroupDifferences} response(s) have a division or employee_group different from the current Employees record. Group evidence uses the employee master join; source fields remain unchanged.`)
  }
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

  const invalidSummary = countWhere(dataset.datasetSummary, (entry) => !isFiniteNumber(entry.value))
  if (invalidSummary > 0) warnings.push(`Dataset_Summary.Value: ${invalidSummary} missing or invalid numeric value(s).`)

  const collectionChecks = [
    { label: 'Employees', metric: 'Employees', rows: employees },
    { label: 'Onboarding_Survey', metric: 'Onboarding responses', rows: onboardingSurveys },
    { label: 'Pulse_Survey', metric: 'Pulse responses', rows: pulseSurveys },
    { label: 'Exit_Survey', metric: 'Exit survey responses', rows: exitSurveys },
    { label: 'Action_Tracker', metric: 'Action records', rows: actions },
  ]
  for (const { label, metric, rows } of collectionChecks) {
    if (rows.length === 0) warnings.push(`${label}: no rows available.`)
    const entry = dataset.datasetSummary.find((item) => item.metric === metric)
    if (entry && entry.value !== rows.length) {
      errors.push(`Dataset_Summary "${entry.metric}" reports ${entry.value} but ${label} contains ${rows.length} rows.`)
    }
  }

  const summaryChecks: readonly { keyword: string; actual: number }[] = [
    { keyword: 'active', actual: countWhere(employees, (e) => e.exitStatus === 'Active') },
    { keyword: 'leaver', actual: countWhere(employees, (e) => getEmployeeExitStatus(e.exitStatus) === 'Leaver') },
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
