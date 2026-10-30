import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDemoRole } from '@/hooks/use-demo-role'
import { ROLE_CONFIG } from '@/lib/demo-role-config'

export function NotFoundPage() {
  const { role } = useDemoRole()
  const defaultRoute = role ? ROLE_CONFIG[role].defaultRoute : '/login'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found.</h1>
      <Button asChild size="lg" className="mt-2">
        <Link to={defaultRoute}>Back to workspace</Link>
      </Button>
    </div>
  )
}
