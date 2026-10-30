import { useEffect, useMemo } from 'react'
import { useHrData } from '@/hooks/use-hr-data'
import { calculateHrAnalytics } from '@/services/hr-analytics.service'
import type { HrAnalytics } from '@/types/hr-analytics'
import type { HrDataset } from '@/types/hr-data'
import { devWarn } from '@/utils/dev-warn'

type HrAnalyticsState = {
  data: HrDataset | null
  analytics: HrAnalytics | null
  isLoading: boolean
  error: string | null
  retry: () => void
}

/**
 * Surfaces data-quality problems once per dataset load, development only.
 * `devWarn` dedupes by message, so a re-render or a retry cannot turn this into
 * log spam. Nothing else is logged: a load summary is noise in a finished app.
 */
function reportDataQuality(analytics: HrAnalytics): void {
  if (!import.meta.env.DEV) return
  for (const error of analytics.dataQuality.errors) devWarn(`data quality error — ${error}`)
  for (const warning of analytics.dataQuality.warnings) devWarn(`data quality — ${warning}`)
}

/**
 * Analytics are calculated once per dataset, never per render, and only after
 * the workbook has actually loaded. A load failure leaves `analytics` as `null`
 * rather than manufacturing numbers.
 */
export function useHrAnalytics(): HrAnalyticsState {
  const { data, isLoading, error, retry } = useHrData({ unscoped: true })

  const analytics = useMemo(() => (data ? calculateHrAnalytics(data) : null), [data])

  useEffect(() => {
    if (analytics) reportDataQuality(analytics)
  }, [analytics])

  return { data, analytics, isLoading, error, retry }
}
