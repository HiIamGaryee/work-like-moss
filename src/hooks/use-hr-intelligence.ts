import { useMemo } from 'react'
import { useHrAnalytics } from '@/hooks/use-hr-analytics'
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
  const { data, analytics, isLoading, error, retry } = useHrAnalytics()

  const result = useMemo(
    () => (analytics ? generateHrIntelligence(analytics) : null),
    [analytics],
  )

  return {
    data,
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
