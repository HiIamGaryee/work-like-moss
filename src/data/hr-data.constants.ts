/**
 * Developer note — data privacy
 *
 * The workbook lives in `public/`, so it ships as a static asset and is publicly
 * readable once deployed. That is acceptable here because the dataset is
 * synthetic hackathon data. Never use this architecture for real employee data.
 */
export const HR_DATASET_PATH = '/data/culture-retention-dummy-data.xlsx'

export const HR_SHEETS = {
  employees: 'Employees',
  onboarding: 'Onboarding_Survey',
  pulse: 'Pulse_Survey',
  exit: 'Exit_Survey',
  actions: 'Action_Tracker',
  dictionary: 'Data_Dictionary',
  summary: 'Dataset_Summary',
} as const

export type HrSheetName = (typeof HR_SHEETS)[keyof typeof HR_SHEETS]

export const REQUIRED_SHEETS: HrSheetName[] = Object.values(HR_SHEETS)

/**
 * Canonical categorical values, shared by the parser (validation) and the
 * analytics layer (deterministic ordering of breakdowns).
 */
export const EXIT_STATUSES = ['Active', 'Leaver'] as const

export const WOULD_RECOMMEND_VALUES = ['Yes', 'No', 'Unsure'] as const

export const ACTION_STATUSES = ['Planned', 'In Progress', 'Completed'] as const

/** Interpret the workbook's `Left` as Leaver without changing the source status. */
export function getEmployeeExitStatus(status: string): (typeof EXIT_STATUSES)[number] | null {
  if (status === 'Active') return 'Active'
  if (status === 'Left' || status === 'Leaver') return 'Leaver'
  return null
}
