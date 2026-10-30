import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDemoRole } from '@/hooks/use-demo-role'
import { getRoleDivision } from '@/lib/demo-role-config'
import { scopeDatasetToDivision } from '@/lib/divisions'
import { loadHrDataset, reloadHrDataset } from '@/services/hr-data.service'
import type { HrDataset } from '@/types/hr-data'

type HrDataState = {
  data: HrDataset | null
  isLoading: boolean
  error: string | null
}

const INITIAL_STATE: HrDataState = { data: null, isLoading: true, error: null }

export function useHrData({ unscoped = false }: { unscoped?: boolean } = {}) {
  const { role, division } = useDemoRole()
  const [state, setState] = useState<HrDataState>(INITIAL_STATE)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback((load: () => Promise<HrDataset>) => {
    load()
      .then((data) => {
        if (mounted.current) setState({ data, isLoading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!mounted.current) return
        const message = error instanceof Error ? error.message : 'Unable to load HR dataset.'
        setState({ data: null, isLoading: false, error: message })
      })
  }, [])

  useEffect(() => {
    run(loadHrDataset)
  }, [run])

  const retry = useCallback(() => {
    setState(INITIAL_STATE)
    run(reloadHrDataset)
  }, [run])

  const scopedData = useMemo(() => {
    const managerDivision = getRoleDivision(role, division)
    if (!state.data || unscoped || !managerDivision) return state.data
    return scopeDatasetToDivision(state.data, managerDivision)
  }, [division, role, state.data, unscoped])

  return { ...state, data: scopedData, retry }
}
