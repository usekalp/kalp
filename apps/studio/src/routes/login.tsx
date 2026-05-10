import { type FormEvent, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Lock } from 'lucide-react'
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
  const [password, setPassword] = useState('')
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(127,127,255,0.2),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(80,180,255,0.16),transparent_30%)]" />
      <Card className="relative w-full max-w-md border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          <img
            src="/studio/kalp-logo.png"
            alt="Kalp"
            className="mx-auto h-14 w-14 rounded-xl border border-white/10 bg-black/40 p-2"
          />
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Kalp Studio
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your Studio credentials to continue.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Username
              </label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="bg-black/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Password
              </label>
              <Input
                value={password}
                type="password"
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="bg-black/30"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full bg-primary/90 transition-all hover:bg-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
