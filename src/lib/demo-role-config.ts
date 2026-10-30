export const DEMO_ROLE_STORAGE_KEY = 'work-like-moss:demo-role'
export const DEMO_DIVISION_STORAGE_KEY = 'work-like-moss:manager-division'

export const DEMO_ROLES = ['hr', 'ceo', 'manager'] as const

export type DemoRole = (typeof DEMO_ROLES)[number]

type DemoRoleConfig = {
  label: string
  description: string
  defaultRoute: string
  allowedRoutes: readonly string[]
  allowUnknownRoutes: boolean
  requiresDivision: boolean
}

export const ROLE_CONFIG = {
  hr: {
    label: 'HR',
    description: 'Full people intelligence workspace',
    defaultRoute: '/',
    allowedRoutes: [
      '/',
      '/about',
      '/demo-guide',
      '/faq',
      '/insights',
      '/employees',
      '/actions',
      '/automations',
      '/impact',
    ],
    allowUnknownRoutes: true,
    requiresDivision: false,
  },
  ceo: {
    label: 'CEO',
    description: 'Executive workforce overview',
    defaultRoute: '/',
    allowedRoutes: ['/', '/ask'],
    allowUnknownRoutes: false,
    requiresDivision: false,
  },
  manager: {
    label: 'Manager',
    description: 'Team insights and action workspace',
    defaultRoute: '/insights',
    allowedRoutes: [
      '/about',
      '/demo-guide',
      '/faq',
      '/insights',
      '/employees',
      '/actions',
      '/automations',
      '/impact',
    ],
    allowUnknownRoutes: true,
    requiresDivision: true,
  },
} as const satisfies Record<DemoRole, DemoRoleConfig>

export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === 'string' && DEMO_ROLES.some((role) => role === value)
}

function normalisePathname(pathname: string): string {
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '') || '/'
}

function matchesRoute(pathname: string, route: string): boolean {
  if (route === '/') return pathname === route
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isKnownRoute(pathname: string): boolean {
  return DEMO_ROLES.some((candidateRole) => {
    const candidateConfig: DemoRoleConfig = ROLE_CONFIG[candidateRole]

    return candidateConfig.allowedRoutes.some((route) => matchesRoute(pathname, route))
  })
}

export function canAccessRoute(role: DemoRole, pathname: string): boolean {
  const normalisedPathname = normalisePathname(pathname)
  const roleConfig: DemoRoleConfig = ROLE_CONFIG[role]

  if (roleConfig.allowedRoutes.some((route) => matchesRoute(normalisedPathname, route))) {
    return true
  }

  return !isKnownRoute(normalisedPathname) && roleConfig.allowUnknownRoutes
}

export function getRoleDivision(role: DemoRole | null, division: string | null): string | null {
  return role && ROLE_CONFIG[role].requiresDivision ? division : null
}
