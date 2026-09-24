import { HR_SHEETS } from '@/data/hr-data.constants'
import { fetchHrWorkbook, type WorkbookSheets } from '@/lib/excel'
import type {
  ActionRecord,
  DataDictionaryEntry,
  DatasetSummaryItem,
  Employee,
  ExitSurvey,
  HrDataset,
  OnboardingSurvey,
  PulseSurvey,
} from '@/types/hr-data'
import { excelSerialToDate } from '@/utils/excel-date'
import {
  createRowReader,
  toNullableText,
  toNumber,
  toText,
  type SheetRow,
} from '@/utils/normalise'

const employeeFromRow = (row: SheetRow): Employee => {
  const cell = createRowReader(row)
  return {
    employeeId: toText(cell('employee_id')),
    division: toText(cell('division')),
    employeeGroup: toText(cell('employee_group')),
    location: toText(cell('location')),
    joinDate: excelSerialToDate(cell('join_date')) ?? '',
    tenureMonths: toNumber(cell('tenure_months')),
    baseEngagement: toNumber(cell('base_engagement')),
    exitStatus: toText(cell('exit_status')),
    exitDate: excelSerialToDate(cell('exit_date')),
    exitReason: toNullableText(cell('exit_reason')),
  }
}

const onboardingFromRow = (row: SheetRow): OnboardingSurvey => {
  const cell = createRowReader(row)
  return {
    employeeId: toText(cell('employee_id')),
    division: toText(cell('division')),
    employeeGroup: toText(cell('employee_group')),
    joinDate: excelSerialToDate(cell('join_date')) ?? '',
    surveyDate: excelSerialToDate(cell('survey_date')) ?? '',
    overallScore: toNumber(cell('overall_score')),
    managerSupport: toNumber(cell('manager_support')),
    roleClarity: toNumber(cell('role_clarity')),
    toolsAccess: toNumber(cell('tools_access')),
    comment: toText(cell('comment')),
  }
}

const pulseFromRow = (row: SheetRow): PulseSurvey => {
  const cell = createRowReader(row)
  return {
    employeeId: toText(cell('employee_id')),
    surveyWave: toText(cell('survey_wave')),
    surveyDate: excelSerialToDate(cell('survey_date')) ?? '',
    engagementScore: toNumber(cell('engagement_score')),
    managerSupport: toNumber(cell('manager_support')),
    workload: toNumber(cell('workload')),
    careerGrowth: toNumber(cell('career_growth')),
    belonging: toNumber(cell('belonging')),
    comment: toText(cell('comment')),
  }
}

const exitFromRow = (row: SheetRow): ExitSurvey => {
  const cell = createRowReader(row)
  return {
    employeeId: toText(cell('Employee_ID')),
    exitDate: excelSerialToDate(cell('Exit_Date')) ?? '',
    // The source workbook misspells this header; the app model does not.
    primaryExitReason: toText(cell('Primay_Exit_Reason', 'Primary_Exit_Reason')),
    overallExperience: toNumber(cell('Overall_Experience')),
    managerSupport: toNumber(cell('Manager_Support')),
    careerOpportunity: toNumber(cell('Career_Opportunity')),
    workload: toNumber(cell('Workload')),
    wouldRecommend: toText(cell('Would_Recommend')),
    comment: toText(cell('Comment')),
  }
}

const actionFromRow = (row: SheetRow): ActionRecord => {
  const cell = createRowReader(row)
  return {
    actionId: toText(cell('Action_ID')),
    scope: toText(cell('Scope')),
    theme: toText(cell('Theme')),
    issue: toText(cell('Issue')),
    action: toText(cell('Action')),
    owner: toText(cell('Owner')),
    startDate: excelSerialToDate(cell('Start_Date')) ?? '',
    status: toText(cell('Status')),
    successMeasure: toText(cell('Success_Measure')),
  }
}

const dictionaryFromRow = (row: SheetRow): DataDictionaryEntry => {
  const cell = createRowReader(row)
  return {
    table: toText(cell('Table')),
    field: toText(cell('Field')),
    description: toText(cell('Description')),
    type: toText(cell('Type')),
  }
}

const summaryFromRow = (row: SheetRow): DatasetSummaryItem => {
  const cell = createRowReader(row)
  return {
    metric: toText(cell('Metric')),
    value: toNumber(cell('Value')),
  }
}

export function buildDataset(sheets: WorkbookSheets): HrDataset {
  return {
    employees: sheets[HR_SHEETS.employees].map(employeeFromRow),
    onboardingSurveys: sheets[HR_SHEETS.onboarding].map(onboardingFromRow),
    pulseSurveys: sheets[HR_SHEETS.pulse].map(pulseFromRow),
    exitSurveys: sheets[HR_SHEETS.exit].map(exitFromRow),
    actions: sheets[HR_SHEETS.actions].map(actionFromRow),
    dataDictionary: sheets[HR_SHEETS.dictionary].map(dictionaryFromRow),
    datasetSummary: sheets[HR_SHEETS.summary].map(summaryFromRow),
  }
}

let datasetPromise: Promise<HrDataset> | null = null

export function loadHrDataset(): Promise<HrDataset> {
  datasetPromise ??= fetchHrWorkbook()
    .then(buildDataset)
    .catch((error: unknown) => {
      datasetPromise = null
      throw error
    })

  return datasetPromise
}

export function reloadHrDataset(): Promise<HrDataset> {
  datasetPromise = null
  return loadHrDataset()
}
