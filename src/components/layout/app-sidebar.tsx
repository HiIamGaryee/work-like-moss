import { SidebarContent } from '@/components/layout/sidebar-content'

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 border-r border-border/60 bg-background lg:block">
      <SidebarContent />
    </aside>
  )
}
