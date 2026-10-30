import { Building2, LogOut } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getNavigationItems } from '@/data/navigation'
import { useDemoRole } from '@/hooks/use-demo-role'
import { ROLE_CONFIG } from '@/lib/demo-role-config'
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

  const handleLogout = (): void => {
    logout()
    onNavigate?.()
    navigate('/login')
  }

  const handleChangeDivision = (): void => {
    logout()
    onNavigate?.()
    navigate('/login', { state: { demoRole: 'manager' } })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b bg-card px-4 py-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
        >
          M
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Work Like Moss</p>
          <p className="truncate text-xs text-muted-foreground">People Intelligence</p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {visibleNavigationItems.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <NavLink
                to={href}
                end={href === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                    isActive
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Separator />

      <div className="min-w-0 space-y-3 p-3">
        <div>
          <p className="truncate text-sm font-medium">{roleLabel} Workspace</p>
          <p className="truncate text-xs text-muted-foreground">Glocomp</p>
        </div>
        <div className="space-y-2 border-t pt-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Viewing as</p>
            <p className="truncate text-sm font-medium">{roleLabel}</p>
          </div>
          {hasDivisionScope && division ? (
            <div className="space-y-2">
              <div>
                <p className="text-[11px] text-muted-foreground">Division</p>
                <p className="truncate text-sm font-medium">{division}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={handleChangeDivision}
              >
                <Building2 aria-hidden="true" />
                Change Division
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut aria-hidden="true" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
