import { MIN_GROUP_DETAIL_RESPONSES } from '@/data/hr-analytics.constants'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrIntelligenceItem } from '@/types/hr-intelligence'
import type { InsightDataSource, InsightScope } from '@/types/hr-insights'

export const PRIVACY_SUPPRESSED_MESSAGE = 'Detailed analytics hidden to protect employee privacy.'

/** The project-wide display rule. Analytical confidence rules remain separate. */
export function canShowGroupDetail(sampleSize: number | null | undefined): boolean {
  return sampleSize !== null && sampleSize !== undefined && sampleSize >= MIN_GROUP_DETAIL_RESPONSES
}

export function getPrivacySuppressedState(sampleSize: number | null | undefined): string | null {
  return canShowGroupDetail(sampleSize) ? null : PRIVACY_SUPPRESSED_MESSAGE
}

function groupSampleSizes(item: Pick<HrIntelligenceItem, 'insight'>, analytics: HrAnalytics): number[] {
  return sampleSizesForScope(item.insight.scope, item.insight.dataSources, analytics)
}

function sampleSizesForScope(
  scope: Pick<InsightScope, 'kind' | 'key'>,
  dataSources: readonly string[],
  analytics: HrAnalytics,
): number[] {
  const { kind, key } = scope
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

  const sourceCounts = dataSources.flatMap((source) => {
    if (source === 'Employees') return employeeCount === undefined ? [] : [employeeCount]
    if (source === 'Pulse Survey') return pulseCount === undefined ? [] : [pulseCount]
    if (source === 'Onboarding Survey') return onboardingCount === undefined ? [] : [onboardingCount]
    if (source === 'Exit Survey') return exitCount === undefined ? [] : [exitCount]
    return []
  })

  return sourceCounts.length > 0
    ? sourceCounts
    : []
}

export function isGroupScopeSuppressed(
  scope: Pick<InsightScope, 'kind' | 'key'> | undefined,
  dataSources: readonly InsightDataSource[],
  analytics: HrAnalytics | null | undefined,
): boolean {
  if (!scope || !analytics || !['division', 'employee-group'].includes(scope.kind)) return false
  const sampleSizes = sampleSizesForScope(scope, dataSources, analytics)
  return sampleSizes.length === 0 || sampleSizes.some((size) => size < MIN_GROUP_DETAIL_RESPONSES)
}

/** Fails closed when a group evidence source cannot establish a safe sample. */
export function isInsightDetailSuppressed(
  item: Pick<HrIntelligenceItem, 'insight'>,
  analytics: HrAnalytics | null | undefined,
): boolean {
  if (!analytics || !['division', 'employee-group'].includes(item.insight.scope.kind)) return false
  const sampleSizes = groupSampleSizes(item, analytics)
  return sampleSizes.length === 0 || sampleSizes.some((size) => size < MIN_GROUP_DETAIL_RESPONSES)
}
