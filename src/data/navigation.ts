import {
  ChartNoAxesCombined,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import {
  canAccessRoute,
  DEMO_ROLES,
  type DemoRole,
} from '@/lib/demo-role-config'

export type NavigationItem = {
  label: string
  href: string
  icon: LucideIcon
  roles: DemoRole[]
  roleLabels?: Partial<Record<DemoRole, string>>
}

const rolesForRoute = (href: string): DemoRole[] =>
  DEMO_ROLES.filter((role) => canAccessRoute(role, href))

export const navigationItems: NavigationItem[] = [
  {
    label: 'Overview',
    href: '/',
    icon: LayoutDashboard,
    roles: rolesForRoute('/'),
    roleLabels: { ceo: 'Dashboard' },
  },
  {
    label: 'Ask Work Like Moss',
    href: '/ask',
    icon: MessageSquareText,
    roles: rolesForRoute('/ask'),
  },
  {
    label: 'Signals',
    href: '/insights',
    icon: Sparkles,
    roles: rolesForRoute('/insights'),
  },
  {
    label: 'Employees',
    href: '/employees',
    icon: Users,
    roles: rolesForRoute('/employees'),
  },
  { label: 'Actions', href: '/actions', icon: ListChecks, roles: rolesForRoute('/actions') },
  {
    label: 'Follow-Up',
    href: '/automations',
    icon: Workflow,
    roles: rolesForRoute('/automations'),
  },
  { label: 'Impact', href: '/impact', icon: ChartNoAxesCombined, roles: rolesForRoute('/impact') },
]

export const getNavigationItems = (role: DemoRole): NavigationItem[] =>
  navigationItems
    .filter((item) => item.roles.includes(role))
    .map((item) => ({ ...item, label: item.roleLabels?.[role] ?? item.label }))
