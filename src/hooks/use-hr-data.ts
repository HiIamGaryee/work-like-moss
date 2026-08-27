import { useCallback, useEffect, useRef, useState } from 'react'
import { loadHrDataset, reloadHrDataset } from '@/services/hr-data.service'
import type { HrDataset } from '@/types/hr-data'

type HrDataState = {
  data: HrDataset | null
  isLoading: boolean
  error: string | null
}

const INITIAL_STATE: HrDataState = { data: null, isLoading: true, error: null }

export function useHrData() {
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

  return { ...state, retry }
}
