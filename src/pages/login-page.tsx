import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthLoading } from '@/components/auth-loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDemoRole } from '@/hooks/use-demo-role'
import { useHrData } from '@/hooks/use-hr-data'
import { getAvailableDivisions } from '@/lib/divisions'
import { DEMO_ROLES, FAKE_AUTH_MS, ROLE_CONFIG, type DemoRole } from '@/lib/demo-role-config'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginAs, role: currentRole, division: currentDivision } = useDemoRole()
  const requestedRole = (location.state as { demoRole?: DemoRole } | null)?.demoRole
  const [selectedRole, setSelectedRole] = useState<DemoRole | null>(
    requestedRole ?? currentRole,
  )
  const [selectedDivision, setSelectedDivision] = useState<string | undefined>(
    requestedRole === 'manager' ? undefined : currentDivision ?? undefined,
  )
  const [signingIn, setSigningIn] = useState(false)
  const timer = useRef<number>(undefined)
  const { data, isLoading } = useHrData({ unscoped: true })
  const divisions = useMemo(() => getAvailableDivisions(data), [data])
  const managerSelected = selectedRole ? ROLE_CONFIG[selectedRole].requiresDivision : false
  const validManagerDivision = selectedDivision
    ? divisions.includes(selectedDivision)
    : false

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const signIn = (role: DemoRole, division?: string): void => {
    if (signingIn) return
    setSigningIn(true)
    timer.current = window.setTimeout(() => {
      loginAs(role, division)
      navigate(ROLE_CONFIG[role].defaultRoute)
    }, FAKE_AUTH_MS)
  }

  const selectRole = (role: DemoRole): void => {
    if (signingIn) return
    setSelectedRole(role)
    if (ROLE_CONFIG[role].requiresDivision) {
      setSelectedDivision(undefined)
      return
    }

    signIn(role)
  }

  const continueAsManager = (): void => {
    if (selectedRole !== 'manager' || !validManagerDivision || !selectedDivision) return
    signIn(selectedRole, selectedDivision)
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <img
        src="/assets/login-bbg.jpeg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full scale-110 object-cover blur-md"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-background/30" />
      {signingIn ? <AuthLoading message="Signing you in..." /> : null}
      <Card className="relative w-full max-w-lg shadow-xl">
        <CardHeader className="gap-4 border-b pb-5">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
            >
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Work Like Moss</p>
              <p className="truncate text-xs text-muted-foreground">People Intelligence</p>
            </div>
            <Badge variant="outline" className="ml-auto">
              Portfolio Demo
            </Badge>
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl">Choose your demo role</CardTitle>
            <CardDescription>Choose a role to explore the experience.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-3">
            {DEMO_ROLES.map((role) => {
              const config = ROLE_CONFIG[role]
              const isCurrent = role === selectedRole

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectRole(role)}
                  className="group flex w-full items-center gap-4 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{config.label}</p>
                      {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
                  </div>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </button>
              )
            })}
          </div>

          {managerSelected ? (
            <div className="space-y-4 border-t pt-5">
              <div className="space-y-1.5">
                <Label htmlFor="manager-division">Division</Label>
                <Select
                  value={selectedDivision}
                  onValueChange={setSelectedDivision}
                  disabled={isLoading || divisions.length === 0}
                >
                  <SelectTrigger id="manager-division" className="w-full">
                    <SelectValue
                      placeholder={isLoading ? 'Loading divisions...' : 'Select division'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((division) => (
                      <SelectItem key={division} value={division}>
                        {division}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoading && divisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No divisions available.</p>
                ) : null}
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={continueAsManager}
                disabled={isLoading || !validManagerDivision}
              >
                Continue as Manager
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </CardContent>

        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Demo access only. No account or credentials required.
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
