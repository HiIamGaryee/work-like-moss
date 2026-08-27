export type EmployeeExitStatus = 'Active' | 'Leaver'

export type WouldRecommend = 'Yes' | 'No' | 'Unsure'

export type ActionStatus = 'Planned' | 'In Progress' | 'Completed'

export interface Employee {
  employeeId: string
  division: string
  employeeGroup: string
  location: string
  joinDate: string
  tenureMonths: number
  baseEngagement: number
  exitStatus: EmployeeExitStatus
  exitDate: string | null
  exitReason: string | null
}

export interface OnboardingSurvey {
  employeeId: string
  division: string
  employeeGroup: string
  joinDate: string
  surveyDate: string
  overallScore: number
  managerSupport: number
  roleClarity: number
  toolsAccess: number
  comment: string
}

export interface PulseSurvey {
  employeeId: string
  surveyWave: string
  surveyDate: string
  engagementScore: number
  managerSupport: number
  workload: number
  careerGrowth: number
  belonging: number
  comment: string
}

export interface ExitSurvey {
  employeeId: string
  exitDate: string
  primaryExitReason: string
  overallExperience: number
  managerSupport: number
  careerOpportunity: number
  workload: number
  wouldRecommend: WouldRecommend
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
  status: ActionStatus
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
  value: number
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
