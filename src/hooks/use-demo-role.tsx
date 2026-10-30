import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  canAccessRoute,
  DEMO_DIVISION_STORAGE_KEY,
  DEMO_ROLE_STORAGE_KEY,
  isDemoRole,
  ROLE_CONFIG,
  type DemoRole,
} from '@/lib/demo-role-config'

type DemoSession = {
  role: DemoRole | null
  division: string | null
}

type DemoRoleContextValue = DemoSession & {
  loginAs: (role: DemoRole, division?: string) => void
  logout: () => void
  isAllowed: (pathname: string) => boolean
}

const DemoRoleContext = createContext<DemoRoleContextValue | null>(null)

function readStoredSession(): DemoSession {
  const storedRole = window.localStorage.getItem(DEMO_ROLE_STORAGE_KEY)
  const role = isDemoRole(storedRole) ? storedRole : null

  if (!role) {
    window.localStorage.removeItem(DEMO_ROLE_STORAGE_KEY)
    window.localStorage.removeItem(DEMO_DIVISION_STORAGE_KEY)
    return { role: null, division: null }
  }

  const division = ROLE_CONFIG[role].requiresDivision
    ? window.localStorage.getItem(DEMO_DIVISION_STORAGE_KEY)?.trim() || null
    : null

  if (!ROLE_CONFIG[role].requiresDivision) {
    window.localStorage.removeItem(DEMO_DIVISION_STORAGE_KEY)
  }

  return { role, division }
}

export function DemoRoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession>(readStoredSession)

  const loginAs = useCallback((nextRole: DemoRole, nextDivision?: string): void => {
    const division = ROLE_CONFIG[nextRole].requiresDivision ? nextDivision?.trim() || null : null
    if (ROLE_CONFIG[nextRole].requiresDivision && !division) return

    window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, nextRole)
    if (division) window.localStorage.setItem(DEMO_DIVISION_STORAGE_KEY, division)
    else window.localStorage.removeItem(DEMO_DIVISION_STORAGE_KEY)
    setSession({ role: nextRole, division })
  }, [])

  const logout = useCallback((): void => {
    window.localStorage.removeItem(DEMO_ROLE_STORAGE_KEY)
    window.localStorage.removeItem(DEMO_DIVISION_STORAGE_KEY)
    setSession({ role: null, division: null })
  }, [])

  const isAllowed = useCallback(
    (pathname: string): boolean => (
      session.role ? canAccessRoute(session.role, pathname) : false
    ),
    [session.role],
  )

  const value = useMemo(
    () => ({ ...session, loginAs, logout, isAllowed }),
    [isAllowed, loginAs, logout, session],
  )

  return <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>
}

export function useDemoRole(): DemoRoleContextValue {
  const context = useContext(DemoRoleContext)

  if (!context) throw new Error('useDemoRole must be used within a DemoRoleProvider')
  return context
}
