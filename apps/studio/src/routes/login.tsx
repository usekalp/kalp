import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { KeyRound, Loader2, LogIn, UserRound } from 'lucide-react'
import { login } from '#/lib/api'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { useSession } from '#/hooks/useAuth'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const sessionQuery = useSession()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('••••••••')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (sessionQuery.data?.authenticated) {
      navigate({ to: '/' })
    }
  }, [navigate, sessionQuery.data?.authenticated])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await login({ username, password })
      await sessionQuery.refetch()
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 md:px-10">
      <div className="studio-halo pointer-events-none absolute left-[16%] top-1/2 h-[24rem] w-[24rem] -translate-y-1/2" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(148,163,184,0.08),transparent_38%),radial-gradient(circle_at_75%_55%,rgba(99,102,241,0.08),transparent_32%)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-[1200px] grid-cols-1 items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="studio-tile relative overflow-hidden p-1">
          <CardHeader className="space-y-5 pb-2">
            <img src="/studio/kalp-logo.png" alt="Kalp" className="h-12 w-auto object-contain" />
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">
                Secure Studio Login
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Authenticate into your private control surface.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="text-3xs uppercase tracking-tightest2 text-zinc-400">Username</label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    className="studio-input h-11 rounded-5 pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-3xs uppercase tracking-tightest2 text-zinc-400">Password</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={password}
                    type="password"
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="studio-input h-11 rounded-5 pl-9 font-mono tracking-widest"
                  />
                </div>
              </div>
              {error && (
                <p className="rounded-5 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="h-11 w-full rounded-5 border border-zinc-200/20 bg-gradient-to-r from-zinc-100/20 via-zinc-200/15 to-zinc-100/20 text-zinc-100 transition-all duration-300 hover:shadow-[0_0_28px_-12px_rgba(203,213,225,0.9)]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="relative hidden h-full min-h-[560px] items-center justify-center lg:flex">
          <div className="absolute inset-0 rounded-6 border border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent" />
          <div className="relative h-[340px] w-[340px]">
            <img
              src="/studio/kalp-logo.png"
              alt="Kalp mark"
              className="absolute inset-0 h-full w-full object-contain opacity-35 [filter:drop-shadow(0_0_24px_rgba(148,163,184,0.22))] animate-pulse-slow"
            />
            <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-200/30 bg-gradient-to-br from-zinc-100/40 via-zinc-400/25 to-zinc-100/15 blur-xs" />
          </div>
        </div>
      </div>
    </div>
  )
}
