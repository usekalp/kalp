import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react'

import { login } from '#/lib/api'
import { useSession } from '#/hooks/useAuth'

import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const sessionQuery = useSession()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (sessionQuery.data?.authenticated) {
      navigate({ to: '/', search: { status: '', tags: '' } })
    }
  }, [navigate, sessionQuery.data?.authenticated])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setIsLoading(true)
    setError(null)

    try {
      await login({ username, password })

      await sessionQuery.refetch()

      navigate({
        to: '/',
        search: { status: '', tags: '' },
      })
    } catch (err) {
      setIsLoading(false)
      setError('Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%)]" />

      <div className="absolute left-1/2 top-0 h-130 w-130 -translate-x-1/2 rounded-full bg-white/2.5 blur-3xl" />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[72px_72px] mask-[radial-gradient(circle_at_center,black,transparent_85%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-350 items-center px-6 py-10 lg:px-10">
        <div className="grid w-full grid-cols-1 gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          {/* LEFT SIDE */}
          <div className="flex flex-col justify-center">
            <div className="mt-8">
              <img
                src="/studio/kalp-logo.png"
                alt="Kalp"
                className="h-14 w-auto opacity-95"
              />
            </div>

            <div className="mt-10 max-w-2xl">
              <h1 className="text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">
                Control your
                <span className="block text-zinc-500">AI infrastructure.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base text-balance leading-relaxed text-zinc-400 sm:text-lg">
                Deploy, orchestrate, and manage production-grade AI systems
                through a modern control surface built for teams and
                enterprises.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md">
              {/* glow */}
              <div className="absolute inset-0 rounded-2xl bg-white/3 blur-2xl" />

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_40px_120px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
                {/* top shine */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />

                <div className="relative">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/4">
                      <Lock className="h-5 w-5 text-zinc-300" />
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-white">
                        Studio Access
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        Authenticate into your workspace
                      </p>
                    </div>
                  </div>

                  <form onSubmit={onSubmit} className="mt-10 space-y-5">
                    <div className="space-y-1.5">
                      <Label>Username</Label>

                      <Input
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoComplete="username"
                        className="h-12 rounded-2xl border-white/10 bg-white/3 px-4 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/20"
                        placeholder="admin"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Password</Label>

                      <Input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        className="h-12 rounded-2xl border-white/10 bg-white/3 px-4 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/20"
                        placeholder="***********"
                      />
                    </div>

                    {error && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="group h-12 w-full rounded-2xl bg-white text-sm font-medium text-black transition-all hover:bg-zinc-200"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
