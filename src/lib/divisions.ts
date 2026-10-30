import type { HrAnalysis } from '@/types/hr-analytics'
import type { HrAction, RecommendedAction } from '@/types/hr-actions'
import type { ActionRecord, HrDataset } from '@/types/hr-data'
import type { HrIntelligenceItem, HrIntelligenceResult } from '@/types/hr-intelligence'

export function getAvailableDivisions(
  dataset: Pick<HrDataset, 'employees'> | null | undefined,
): string[] {
  if (!dataset) return []
  return [...new Set(dataset.employees.map(({ division }) => division.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  )
}

function normaliseScope(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function matchesDivisionScope(value: string, division: string): boolean {
  const scope = normaliseScope(value)
  const target = normaliseScope(division)
  return scope === target || ` ${scope} `.includes(` ${target} `)
}

export function scopeDatasetToDivision(dataset: HrDataset, division: string): HrDataset {
  const employees = dataset.employees.filter((employee) => employee.division === division)
  const employeeIds = new Set(employees.map(({ employeeId }) => employeeId))

  return {
    ...dataset,
    employees,
    onboardingSurveys: dataset.onboardingSurveys.filter(
      (survey) => survey.division === division || employeeIds.has(survey.employeeId),
    ),
    pulseSurveys: dataset.pulseSurveys.filter((survey) => employeeIds.has(survey.employeeId)),
    exitSurveys: dataset.exitSurveys.filter((survey) => employeeIds.has(survey.employeeId)),
    actions: dataset.actions.filter((action) => matchesDivisionScope(action.scope, division)),
  }
}

export function intelligenceItemMatchesDivision(
  item: HrIntelligenceItem,
  division: string,
): boolean {
  return item.insight.scope.kind === 'division' && item.insight.scope.key === division
}

export function scopeIntelligenceResult(
  result: HrIntelligenceResult,
  division: string,
): HrIntelligenceResult {
  const items = result.items.filter((item) => intelligenceItemMatchesDivision(item, division))
  const visibleLimit = Math.max(result.visibleItems.length, 1)
  const priorityLimit = Math.max(result.topPriorityItems.length, 1)

  return {
    items,
    visibleItems: items.slice(0, visibleLimit),
    topPriorityItems: items.slice(0, priorityLimit),
  }
}

export function scopeAnalysisToDivision(analysis: HrAnalysis, division: string): HrAnalysis {
  const priorities = analysis.priorities.filter(
    (priority) => priority.scopeType === 'division' && priority.scopeName === division,
  )
  const priorityIds = new Set(priorities.map(({ id }) => id))

  return {
    ...analysis,
    divisions: analysis.divisions.filter((entry) => entry.division === division),
    employeeGroups: [],
    patterns: {
      ...analysis.patterns,
      lowestEngagementDivision:
        analysis.patterns.lowestEngagementDivision?.division === division
          ? analysis.patterns.lowestEngagementDivision
          : null,
      highestLeaverRateDivision:
        analysis.patterns.highestLeaverRateDivision?.division === division
          ? analysis.patterns.highestLeaverRateDivision
          : null,
      lowestEngagementEmployeeGroup: null,
      signals: analysis.patterns.signals.filter(({ message }) =>
        normaliseScope(message).includes(normaliseScope(division)),
      ),
    },
    evidence: {
      ...analysis.evidence,
      divisions: analysis.evidence.divisions.filter(({ group }) => group === division),
      employeeGroups: [],
      patternEvidenceById: Object.fromEntries(
        Object.entries(analysis.evidence.patternEvidenceById).filter(([id]) => priorityIds.has(id)),
      ),
    },
    priorities,
  }
}

export function actionMatchesDivision(
  action: HrAction | RecommendedAction | ActionRecord,
  division: string,
): boolean {
  if ('affectedScope' in action) return matchesDivisionScope(action.affectedScope, division)
  return matchesDivisionScope(action.scope, division)
}
