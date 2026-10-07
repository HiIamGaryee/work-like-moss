import {
  ChartNoAxesCombined,
  Info,
  LayoutDashboard,
  ListChecks,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export type NavigationItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const navigationItems: NavigationItem[] = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Insights', href: '/insights', icon: Sparkles },
  { label: 'Employees', href: '/employees', icon: Users },
  { label: 'Actions', href: '/actions', icon: ListChecks },
  { label: 'Automations', href: '/automations', icon: Workflow },
  { label: 'Impact', href: '/impact', icon: ChartNoAxesCombined },
  { label: 'About MVP', href: '/about', icon: Info },
]
