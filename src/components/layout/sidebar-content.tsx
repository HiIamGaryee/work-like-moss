import { NavLink } from 'react-router-dom'
import { Separator } from '@/components/ui/separator'
import { navigationItems } from '@/data/navigation'
import { cn } from '@/lib/utils'

type SidebarContentProps = {
  onNavigate?: () => void
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
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
          {navigationItems.map(({ label, href, icon: Icon }) => (
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

      <div className="min-w-0 p-3">
        <p className="truncate text-sm font-medium">HR Workspace</p>
        <p className="truncate text-xs text-muted-foreground">Glocomp</p>
      </div>
    </div>
  )
}
