import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowUpRight,
  BotOff,
  Cloud,
  Globe,
  Laptop,
  Orbit,
  RadioTower,
  TerminalSquare,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { useRuntimeAgents, useRuntimeSystem } from '#/hooks/useRuntimeSubscriptions'
import { deriveLabelFromName } from '#/lib/labels'
import type { RuntimeEnvironment } from '#/types/agents'

export const Route = createFileRoute('/_studio/')({
  component: DashboardPage,
})

function DashboardPage() {
  const agentsQuery = useRuntimeAgents()
  const systemQuery = useRuntimeSystem()
  const cards = agentsQuery.data?.agents ?? []

  return (
    <main className="space-y-6">
      <section className="studio-tile grid gap-4 p-5 xl:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Runtime Console</p>
          <h1 className="studio-metal-text mt-2 text-2xl font-semibold">Kalp Studio</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Live runtime surface for agent metadata, routes, executions, state availability,
            contracts, triggers, and conversational inspection.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SystemStat
            label="Runtime mode"
            value={systemQuery.data?.runtimeMode === 'remote' ? 'Remote' : 'Local'}
            icon={<Cloud className="h-4 w-4" />}
            loading={systemQuery.isLoading}
          />
          <SystemStat
            label="Studio mode"
            value={systemQuery.data?.studioMode === 'live-workspace' ? 'Live Workspace' : 'Bundled Artifact'}
            icon={<TerminalSquare className="h-4 w-4" />}
            loading={systemQuery.isLoading}
          />
          <SystemStat
            label="Agents"
            value={String(systemQuery.data?.agentCount ?? 0)}
            icon={<RadioTower className="h-4 w-4" />}
            loading={systemQuery.isLoading}
          />
          <SystemStat
            label="Subscriptions"
            value={systemQuery.data?.supportsSubscriptions.agents ?? 'polling'}
            icon={<Activity className="h-4 w-4" />}
            loading={systemQuery.isLoading}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {agentsQuery.isLoading &&
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="studio-tile rounded-[5px]">
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}

        {!agentsQuery.isLoading &&
          cards.map((agent) => (
            <Card
              key={agent.name}
              className="studio-tile group rounded-[5px] transition-all duration-300 hover:-translate-y-[1px]"
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="studio-metal-text text-base font-semibold">
                    {agent.label ?? deriveLabelFromName(agent.name)}
                  </CardTitle>
                  {agent.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                  ) : null}
                </div>
                <Link
                  to="/agent/$agentName"
                  params={{ agentName: agent.name }}
                  className="rounded-[4px] border border-white/10 p-1 text-muted-foreground transition hover:border-white/20 hover:text-foreground"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-200/20 bg-white/[0.02] text-zinc-200">
                    {agent.version ?? 'v0'}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    {environmentIcon(agent.environment)}
                    {formatEnvironment(agent.environment)}
                  </Badge>
                  <Badge
                    variant={agent.status === 'online' ? 'default' : 'outline'}
                    className={
                      agent.status === 'online'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'border-white/10 bg-transparent text-zinc-500'
                    }
                  >
                    <Activity className="mr-1 h-3 w-3" />
                    {agent.status}
                  </Badge>
                </div>

                {agent.tags && agent.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {agent.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="outline" className="border-white/10 text-zinc-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="truncate">
                    <span className="text-zinc-500">Updated:</span> {agent.updatedAt ?? 'n/a'}
                  </p>
                  <p className="truncate">
                    <span className="text-zinc-500">Hash:</span> {agent.hash ?? 'unpublished'}
                  </p>
                  <p className="truncate">
                    Endpoint:{' '}
                    {agent.workerUrl ? (
                      <a
                        href={agent.workerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-zinc-200 hover:text-white hover:underline"
                      >
                        <Globe className="mr-1 h-3.5 w-3.5" />
                        {agent.workerUrl}
                      </a>
                    ) : (
                      'not deployed'
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
      </section>

      {!agentsQuery.isLoading && cards.length === 0 && (
        <section className="studio-tile flex min-h-[300px] w-full flex-col items-center justify-center rounded-[5px] border-dashed p-12 text-center">
          <BotOff className="mb-4 h-9 w-9 text-muted-foreground/80" />
          <h2 className="text-lg font-medium">No agents found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Push or sync agents to populate the live runtime index.
          </p>
        </section>
      )}
    </main>
  )
}

function SystemStat({
  label,
  value,
  icon,
  loading,
}: {
  label: string
  value: string
  icon: ReactNode
  loading?: boolean
}) {
  return (
    <div className="rounded-[5px] border border-white/10 bg-black/20 p-3">
      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      {loading ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <div className="flex items-center gap-2 text-zinc-100">
          {icon}
          {value}
        </div>
      )}
    </div>
  )
}

function formatEnvironment(environment: RuntimeEnvironment) {
  if (environment === 'both') return 'Local + Remote'
  if (environment === 'local') return 'Local'
  return 'Remote'
}

function environmentIcon(environment: RuntimeEnvironment) {
  if (environment === 'both') return <Orbit className="h-3 w-3" />
  if (environment === 'local') return <Laptop className="h-3 w-3" />
  return <Cloud className="h-3 w-3" />
}
