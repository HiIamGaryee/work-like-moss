import { useMemo } from 'react'
import { useDemoRole } from '@/hooks/use-demo-role'
import { useHrData } from '@/hooks/use-hr-data'
import { getRoleDivision } from '@/lib/demo-role-config'
import { scopeAnalysisToDivision } from '@/lib/divisions'
import { calculateHrAnalysis } from '@/services/hr-analytics.service'

export function useHrAnalysis() {
  const { role, division } = useDemoRole()
  const { data, isLoading, error, retry } = useHrData({ unscoped: true })
  const managerDivision = getRoleDivision(role, division)
  const analysis = useMemo(() => {
    if (!data) return null
    const fullAnalysis = calculateHrAnalysis(data)
    return managerDivision ? scopeAnalysisToDivision(fullAnalysis, managerDivision) : fullAnalysis
  }, [data, managerDivision])
  return { analysis, isLoading, error, retry }
}
