import { useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { LoginForm } from '#/features/auth/components/login-form'
import { useSession } from '#/features/auth/hooks/use-session'
import { Lock } from 'lucide-react'
import { AnimatedPage } from '../animated-page'

function navigateToRedirect(
  redirectTo: string,
  navigate: ReturnType<typeof useNavigate>,
) {
  const [path, searchString] = redirectTo.split('?')
  if (searchString) {
    const search: Record<string, string> = {}
    for (const [k, v] of new URLSearchParams(searchString).entries()) {
      search[k] = v
    }
    navigate({ to: path, search, replace: true })
  } else {
    navigate({ to: path, replace: true })
  }
}

export function LoginView() {
  const navigate = useNavigate()
  const { redirectTo } = useSearch({ from: '/login' })
  const sessionQuery = useSession()

  useEffect(() => {
    if (sessionQuery.data?.authenticated) {
      if (redirectTo) {
        navigateToRedirect(redirectTo, navigate)
      } else {
        navigate({ to: '/', search: { status: '', tags: '', search: '' }, replace: true })
      }
    }
  }, [navigate, sessionQuery.data?.authenticated, redirectTo])

  const onSuccess = async () => {
    await sessionQuery.refetch()
    if (redirectTo) {
      navigateToRedirect(redirectTo, navigate)
    } else {
      navigate({ to: '/', search: { status: '', tags: '', search: '' }, replace: true })
    }
  }

  return (
    <AnimatedPage>
      <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%)]" />
        <div className="absolute left-1/2 top-0 h-130 w-130 -translate-x-1/2 rounded-full bg-white/2.5 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[72px_72px] mask-[radial-gradient(circle_at_center,black,transparent_85%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-350 items-center px-6 py-10 lg:px-10">
          <div className="grid w-full grid-cols-1 gap-16 lg:grid-cols-[1.1fr_0.9fr]">
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
                  <span className="block text-zinc-500">
                    AI infrastructure.
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-base text-balance leading-relaxed text-zinc-400 sm:text-lg">
                  Deploy, orchestrate, and manage production-grade AI systems
                  through a modern control surface built for teams and
                  enterprises.
                </p>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-md">
                <div className="absolute inset-0 rounded-2xl bg-white/3 blur-2xl" />

                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_40px_120px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
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

                    <LoginForm onSuccess={onSuccess} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
