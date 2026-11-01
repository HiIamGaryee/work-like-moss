import { Building2, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AuthLoading } from '@/components/auth-loading'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getNavigationItems } from '@/data/navigation'
import { useDemoRole } from '@/hooks/use-demo-role'
import { FAKE_AUTH_MS, ROLE_CONFIG } from '@/lib/demo-role-config'
import { cn } from '@/lib/utils'

type SidebarContentProps = {
  onNavigate?: () => void
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const navigate = useNavigate()
  const { role, division, logout } = useDemoRole()
  const roleLabel = role ? ROLE_CONFIG[role].label : ''
  const hasDivisionScope = role ? ROLE_CONFIG[role].requiresDivision : false
  const visibleNavigationItems = role ? getNavigationItems(role) : []

  const [signingOut, setSigningOut] = useState(false)
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const signOut = (state?: { demoRole: 'manager' }): void => {
    if (signingOut) return
    setSigningOut(true)
    timer.current = window.setTimeout(() => {
      logout()
      onNavigate?.()
      navigate('/login', { state })
    }, FAKE_AUTH_MS)
  }

  return (
    <div className="flex h-full flex-col">
      {signingOut ? <AuthLoading message="Signing you out..." /> : null}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-card px-6">
        <div
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
        >
          M
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm leading-tight font-semibold tracking-tight">Work Like Moss</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">People Intelligence</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pt-5 pb-3">
        <ul className="space-y-1">
          {visibleNavigationItems.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <NavLink
                to={href}
                end={href === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                    isActive
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Separator className="bg-border/60" />

      <div className="min-w-0 space-y-3 p-3">
        <div className="px-3">
          <p className="truncate text-sm font-medium">{roleLabel} Workspace</p>
          <p className="truncate text-xs text-muted-foreground">Glocomp</p>
        </div>
        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="px-3">
            <p className="text-[11px] text-muted-foreground">Viewing as</p>
            <p className="truncate text-sm font-medium">{roleLabel}</p>
          </div>
          {hasDivisionScope && division ? (
            <div className="space-y-2">
              <div className="px-3">
                <p className="text-[11px] text-muted-foreground">Division</p>
                <p className="truncate text-sm font-medium">{division}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start px-3"
                onClick={() => signOut({ demoRole: 'manager' })}
              >
                <Building2 aria-hidden="true" />
                Change Division
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start px-3 text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut aria-hidden="true" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
