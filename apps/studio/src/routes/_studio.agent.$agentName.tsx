import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Activity, ArrowLeft, Globe, ShieldCheck } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { useRuntimeAgent } from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/agent/$agentName')({
  component: AgentLayoutPage,
})

function AgentLayoutPage() {
  const { agentName } = Route.useParams()
  const agentQuery = useRuntimeAgent(agentName)
  const agent = agentQuery.data

  return (
    <main className="space-y-4">
      <header className="rounded-5 border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <img
              src="/studio/kalp-logo.png"
              alt="Kalp"
              className="h-9 w-auto object-contain opacity-90"
            />
            <div className="space-y-2">
              <div>
                <p className="text-2xs uppercase tracking-tightest3 text-zinc-500">
                  Agent
                </p>
                {agentQuery.isLoading ? (
                  <Skeleton className="mt-2 h-7 w-48" />
                ) : (
                  <h1 className="studio-metal-text text-xl font-semibold">
                    {agent?.label ?? agentName}
                  </h1>
                )}
              </div>
              {agent?.description ? (
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {agent.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-white/10 text-zinc-300"
                >
                  {agent?.version ?? 'v0'}
                </Badge>
                <Badge
                  variant={agent?.status === 'online' ? 'default' : 'outline'}
                  className={
                    agent?.status === 'online'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'border-white/10 text-zinc-400'
                  }
                >
                  <Activity className="mr-1 h-3 w-3" />
                  {agent?.status ?? 'offline'}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {agent?.public
                    ? 'Public routes enabled'
                    : 'Authenticated runtime'}
                </Badge>
                {agent?.workerUrl ? (
                  <a
                    href={agent.workerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
                  >
                    <Globe className="h-3 w-3" />
                    Open endpoint
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex items-center rounded-5 border border-white/15 px-3 py-2 text-xs uppercase tracking-tightest text-zinc-400 transition hover:border-white/25 hover:text-zinc-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <Outlet />
    </main>
  )
}
