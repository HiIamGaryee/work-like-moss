import { MIN_GROUP_DETAIL_RESPONSES } from '@/data/hr-analytics.constants'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'

function groupSampleSizes(item: HrIntelligenceItem, analytics: HrAnalytics): number[] {
  const { kind, key } = item.insight.scope
  if (key === null || (kind !== 'division' && kind !== 'employee-group')) return []

  const employeeCount = kind === 'division'
    ? analytics.employees.byDivision.find((entry) => entry.division === key)?.employeeCount
    : analytics.employees.byEmployeeGroup.find((entry) => entry.group === key)?.employeeCount
  const pulseCount = kind === 'division'
    ? analytics.pulse.byDivision.find((entry) => entry.group === key)?.responseCount
    : analytics.pulse.byEmployeeGroup.find((entry) => entry.group === key)?.responseCount
  const onboardingCount = kind === 'division'
    ? analytics.onboarding.byDivision.find((entry) => entry.group === key)?.responseCount
    : analytics.onboarding.byEmployeeGroup.find((entry) => entry.group === key)?.responseCount
  const exitCount = kind === 'division'
    ? analytics.exits.byDivision.find((entry) => entry.division === key)?.exitResponseCount
    : undefined

  const sourceCounts = item.insight.dataSources.flatMap((source) => {
    if (source === 'Employees') return employeeCount === undefined ? [] : [employeeCount]
    if (source === 'Pulse Survey') return pulseCount === undefined ? [] : [pulseCount]
    if (source === 'Onboarding Survey') return onboardingCount === undefined ? [] : [onboardingCount]
    if (source === 'Exit Survey') return exitCount === undefined ? [] : [exitCount]
    return []
  })

  return sourceCounts.length > 0
    ? sourceCounts
    : item.insight.sampleSize === undefined ? [] : [item.insight.sampleSize]
}

/** Fails closed when a group evidence source cannot establish a safe sample. */
export function isInsightDetailSuppressed(
  item: HrIntelligenceItem,
  analytics: HrAnalytics | null | undefined,
): boolean {
  if (!analytics || !['division', 'employee-group'].includes(item.insight.scope.kind)) return false
  const sampleSizes = groupSampleSizes(item, analytics)
  return sampleSizes.length === 0 || sampleSizes.some((size) => size < MIN_GROUP_DETAIL_RESPONSES)
}
