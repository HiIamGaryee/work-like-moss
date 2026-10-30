import { useMemo } from 'react'
import { useDemoRole } from '@/hooks/use-demo-role'
import { useHrAnalytics } from '@/hooks/use-hr-analytics'
import { getRoleDivision } from '@/lib/demo-role-config'
import { scopeDatasetToDivision, scopeIntelligenceResult } from '@/lib/divisions'
import { generateHrIntelligence } from '@/services/hr-intelligence.service'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrDataset } from '@/types/hr-data'
import type { HrIntelligenceItem, HrIntelligenceResult } from '@/types/hr-intelligence'

type HrIntelligenceState = {
  /** The parsed workbook, for consumers that need raw lifecycle records. */
  data: HrDataset | null
  analytics: HrAnalytics | null
  result: HrIntelligenceResult | null
  items: HrIntelligenceItem[]
  visibleItems: HrIntelligenceItem[]
  topPriorityItems: HrIntelligenceItem[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

/**
 * The single hook for the intelligence layer: detection, likely drivers and
 * priority are derived once per analytics object, never per render, and only
 * after the workbook has loaded.
 */
export function useHrIntelligence(): HrIntelligenceState {
  const { role, division } = useDemoRole()
  const { data, analytics, isLoading, error, retry } = useHrAnalytics()
  const managerDivision = getRoleDivision(role, division)

  const result = useMemo(() => {
    if (!analytics) return null
    const fullResult = generateHrIntelligence(analytics)
    return managerDivision ? scopeIntelligenceResult(fullResult, managerDivision) : fullResult
  }, [analytics, managerDivision])
  const scopedData = useMemo(
    () => data && managerDivision ? scopeDatasetToDivision(data, managerDivision) : data,
    [data, managerDivision],
  )

  return {
    data: scopedData,
    analytics,
    result,
    items: result?.items ?? [],
    visibleItems: result?.visibleItems ?? [],
    topPriorityItems: result?.topPriorityItems ?? [],
    isLoading,
    error,
    retry,
  }
}
