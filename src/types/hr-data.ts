export type EmployeeExitStatus = 'Active' | 'Leaver'

export type WouldRecommend = 'Yes' | 'No' | 'Unsure'

export type ActionStatus = 'Planned' | 'In Progress' | 'Completed'

export interface Employee {
  employeeId: string
  division: string
  employeeGroup: string
  location: string
  joinDate: string
  tenureMonths: number | null
  baseEngagement: number | null
  exitStatus: string
  exitDate: string | null
  exitReason: string | null
}

export interface OnboardingSurvey {
  employeeId: string
  division: string
  employeeGroup: string
  joinDate: string
  surveyDate: string
  overallScore: number | null
  managerSupport: number | null
  roleClarity: number | null
  toolsAccess: number | null
  comment: string
}

export interface PulseSurvey {
  employeeId: string
  surveyWave: string
  surveyDate: string
  engagementScore: number | null
  managerSupport: number | null
  workload: number | null
  careerGrowth: number | null
  belonging: number | null
  comment: string
}

export interface ExitSurvey {
  employeeId: string
  exitDate: string
  primaryExitReason: string
  overallExperience: number | null
  managerSupport: number | null
  careerOpportunity: number | null
  workload: number | null
  wouldRecommend: string
  comment: string
}

export interface ActionRecord {
  actionId: string
  scope: string
  theme: string
  issue: string
  action: string
  owner: string
  startDate: string
  status: string
  successMeasure: string
}

export interface DataDictionaryEntry {
  table: string
  field: string
  description: string
  type: string
}

export interface DatasetSummaryItem {
  metric: string
  value: number | null
}

export interface HrDataset {
  employees: Employee[]
  onboardingSurveys: OnboardingSurvey[]
  pulseSurveys: PulseSurvey[]
  exitSurveys: ExitSurvey[]
  actions: ActionRecord[]
  dataDictionary: DataDictionaryEntry[]
  datasetSummary: DatasetSummaryItem[]
}
