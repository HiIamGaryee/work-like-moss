import { useMemo } from 'react'
import { useHrData } from '@/hooks/use-hr-data'
import { calculateHrAnalysis } from '@/services/hr-analytics.service'

export function useHrAnalysis() {
  const { data, isLoading, error, retry } = useHrData()
  const analysis = useMemo(() => (data ? calculateHrAnalysis(data) : null), [data])
  return { analysis, isLoading, error, retry }
}
