import {
  ACTION_STATUSES,
  EXIT_STATUSES,
  EXIT_STATUS_ALIASES,
  HR_SHEETS,
  WOULD_RECOMMEND_VALUES,
} from '@/data/hr-data.constants'
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
import { devWarn } from '@/utils/dev-warn'
import { excelSerialToDate } from '@/utils/excel-date'
import {
  createRowReader,
  toEnum,
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
    tenureMonths: toNumber(cell('tenure_months'), 'Employees.tenure_months'),
    baseEngagement: toNumber(cell('base_engagement'), 'Employees.base_engagement'),
    exitStatus: toEnum(
      cell('exit_status'),
      EXIT_STATUSES,
      'Active',
      'Employees.exit_status',
      EXIT_STATUS_ALIASES,
    ),
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
    overallScore: toNumber(cell('overall_score'), 'Onboarding_Survey.overall_score'),
    managerSupport: toNumber(cell('manager_support'), 'Onboarding_Survey.manager_support'),
    roleClarity: toNumber(cell('role_clarity'), 'Onboarding_Survey.role_clarity'),
    toolsAccess: toNumber(cell('tools_access'), 'Onboarding_Survey.tools_access'),
    comment: toText(cell('comment')),
  }
}

const pulseFromRow = (row: SheetRow): PulseSurvey => {
  const cell = createRowReader(row)
  return {
    employeeId: toText(cell('employee_id')),
    surveyWave: toText(cell('survey_wave')),
    surveyDate: excelSerialToDate(cell('survey_date')) ?? '',
    engagementScore: toNumber(cell('engagement_score'), 'Pulse_Survey.engagement_score'),
    managerSupport: toNumber(cell('manager_support'), 'Pulse_Survey.manager_support'),
    workload: toNumber(cell('workload'), 'Pulse_Survey.workload'),
    careerGrowth: toNumber(cell('career_growth'), 'Pulse_Survey.career_growth'),
    belonging: toNumber(cell('belonging'), 'Pulse_Survey.belonging'),
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
    overallExperience: toNumber(cell('Overall_Experience'), 'Exit_Survey.Overall_Experience'),
    managerSupport: toNumber(cell('Manager_Support'), 'Exit_Survey.Manager_Support'),
    careerOpportunity: toNumber(cell('Career_Opportunity'), 'Exit_Survey.Career_Opportunity'),
    workload: toNumber(cell('Workload'), 'Exit_Survey.Workload'),
    wouldRecommend: toEnum(
      cell('Would_Recommend'),
      WOULD_RECOMMEND_VALUES,
      'Unsure',
      'Exit_Survey.Would_Recommend',
    ),
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
    status: toEnum(cell('Status'), ACTION_STATUSES, 'Planned', 'Action_Tracker.Status'),
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
    value: toNumber(cell('Value'), 'Dataset_Summary.Value'),
  }
}

function buildDataset(sheets: WorkbookSheets): HrDataset {
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

const COLLECTION_CHECKS = [
  { key: 'employees', label: 'Employees', summaryKeyword: 'employee' },
  { key: 'onboardingSurveys', label: 'Onboarding_Survey', summaryKeyword: 'onboarding' },
  { key: 'pulseSurveys', label: 'Pulse_Survey', summaryKeyword: 'pulse' },
  { key: 'exitSurveys', label: 'Exit_Survey', summaryKeyword: 'exit' },
  { key: 'actions', label: 'Action_Tracker', summaryKeyword: 'action' },
] as const

function runHealthCheck(dataset: HrDataset): void {
  if (!import.meta.env.DEV) return

  for (const { key, label, summaryKeyword } of COLLECTION_CHECKS) {
    const count = dataset[key].length
    if (count === 0) {
      devWarn(`${label} parsed 0 rows — check the sheet headers.`)
      continue
    }

    const summary = dataset.datasetSummary.find((item) =>
      item.metric.toLowerCase().includes(summaryKeyword),
    )
    if (summary && summary.value !== count) {
      devWarn(
        `${label} parsed ${count} rows but Dataset_Summary reports ${summary.value} ("${summary.metric}").`,
      )
    }
  }
}

let datasetPromise: Promise<HrDataset> | null = null

export function loadHrDataset(): Promise<HrDataset> {
  datasetPromise ??= fetchHrWorkbook()
    .then((sheets) => {
      const dataset = buildDataset(sheets)
      runHealthCheck(dataset)
      return dataset
    })
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
