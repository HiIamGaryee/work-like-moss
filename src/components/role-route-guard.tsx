import { useEffect, useMemo } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useDemoRole } from '@/hooks/use-demo-role'
import { useHrData } from '@/hooks/use-hr-data'
import { getAvailableDivisions } from '@/lib/divisions'
import { ROLE_CONFIG } from '@/lib/demo-role-config'

export function RoleRouteGuard() {
  const { role, division, logout, isAllowed } = useDemoRole()
  const { data, isLoading } = useHrData({ unscoped: true })
  const { pathname } = useLocation()
  const divisions = useMemo(() => getAvailableDivisions(data), [data])
  const requiresDivision = role ? ROLE_CONFIG[role].requiresDivision : false
  const invalidDivision = requiresDivision && (
    !division || (!isLoading && !divisions.includes(division))
  )

  useEffect(() => {
    if (invalidDivision && (!division || !isLoading)) logout()
  }, [division, invalidDivision, isLoading, logout])

  if (!role) {
    return <Navigate to="/login" replace />
  }

  if (requiresDivision && isLoading) return null

  if (invalidDivision) {
    return <Navigate to="/login" replace state={{ demoRole: 'manager' }} />
  }

  if (!isAllowed(pathname)) {
    return <Navigate to={ROLE_CONFIG[role].defaultRoute} replace />
  }

  return <Outlet />
}
