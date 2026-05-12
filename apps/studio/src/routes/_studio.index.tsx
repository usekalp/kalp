import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowUpRight, Cloud, Globe, House, Laptop, Orbit } from 'lucide-react'
import { getAgents } from '#/lib/api'
import { deriveLabelFromName } from '#/lib/labels'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/_studio/')({
  component: DashboardPage,
})

function DashboardPage() {
  const agentsQuery = useQuery({
    queryKey: ['runtime-agents'],
    queryFn: getAgents,
    retry: false,
  })

  const cards = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data])
  const mode = agentsQuery.data?.mode ?? 'local'

  return (
    <main>
      <section className="studio-tile mb-6 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Dashboard</p>
        <h1 className="studio-metal-text mt-2 text-2xl font-semibold">Agents Command Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Runtime mode: <span className="font-medium text-foreground">{mode}</span>
        </p>
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
              <CardHeader className="flex flex-row items-start justify-between">
                <CardTitle className="studio-metal-text text-base font-semibold">
                  {agent.label ?? deriveLabelFromName(agent.name)}
                </CardTitle>
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

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="truncate">
                    <span className="text-zinc-500">Updated:</span> {agent.updatedAt ?? 'n/a'}
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
        <section className="studio-tile mt-8 flex w-full max-w-2xl flex-col items-center justify-center rounded-[5px] border-dashed p-12 text-center">
          <House className="mb-4 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-medium">No agents found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an agent with <code>kalp create</code> and push it to populate this dashboard.
          </p>
        </section>
      )}
    </main>
  )
}

function formatEnvironment(environment: 'local' | 'remote' | 'both') {
  if (environment === 'both') return 'Local + Remote'
  if (environment === 'local') return 'Local'
  return 'Remote'
}

function environmentIcon(environment: 'local' | 'remote' | 'both') {
  if (environment === 'both') return <Orbit className="h-3 w-3" />
  if (environment === 'local') return <Laptop className="h-3 w-3" />
  return <Cloud className="h-3 w-3" />
}
