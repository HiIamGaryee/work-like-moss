import { Bell, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { DemoMenu } from '@/components/layout/demo-menu'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getNavigationItems, navigationItems } from '@/data/navigation'
import { useDemoRole } from '@/hooks/use-demo-role'
import { ROLE_CONFIG, type DemoRole } from '@/lib/demo-role-config'

type HeaderAction = {
  label: string
  icon: LucideIcon
  /** Present when the control navigates somewhere rather than opening a panel. */
  href?: string
}

/**
 * The bell links to the Attention Inbox instead of opening a second, parallel
 * notification surface — there is one place reminders live.
 */
const headerActions: HeaderAction[] = [{ label: 'Follow-Up', icon: Bell, href: '/automations' }]

/**
 * Longest matching prefix, so a nested route like `/insights/:id` still reports
 * the section it belongs to rather than falling through to "Not found".
 */
function useCurrentPageLabel(role: DemoRole | null) {
  const { pathname } = useLocation()
  const visibleNavigationItems = role ? getNavigationItems(role) : navigationItems

  const exact = visibleNavigationItems.find((item) => item.href === pathname)
  if (exact) return exact.label

  const nested = visibleNavigationItems
    .filter((item) => item.href !== '/' && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return nested?.label ?? 'Not found'
}

export function TopHeader() {
  const { role, isAllowed } = useDemoRole()
  const pageLabel = useCurrentPageLabel(role)
  const visibleHeaderActions = headerActions.filter(
    ({ href }) => href === undefined || isAllowed(href),
  )

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background px-4 md:px-6 lg:px-10">
      <MobileSidebar />

      <p className="truncate text-base font-semibold tracking-tight">{pageLabel}</p>

      <div className="ml-auto flex items-center gap-4">
        {isAllowed('/insights') ? <DemoMenu /> : null}

        {visibleHeaderActions.map(({ label, icon: Icon, href }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={label} asChild={href !== undefined}>
                {href ? (
                  <Link to={href}>
                    <Icon aria-hidden="true" />
                  </Link>
                ) : (
                  <Icon aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}

        <Avatar className="size-9">
          <AvatarFallback className="text-xs font-medium">
            {role ? ROLE_CONFIG[role].label : ''}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
