import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Globe, House } from 'lucide-react'
import { getAgents } from '#/lib/api'
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
      <section className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.02] p-5 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold">Agents Command Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Runtime mode: <span className="font-medium text-foreground">{mode}</span>
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {agentsQuery.isLoading &&
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="border-white/10 bg-white/5">
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
              className="group border-white/10 bg-white/[0.03] shadow-[0_10px_40px_-24px_rgba(79,70,229,0.8)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/20 hover:bg-white/[0.08]"
            >
              <CardHeader className="flex flex-row items-start justify-between">
                <CardTitle className="text-lg font-medium">{agent.name}</CardTitle>
                <Link
                  to="/agent/$agentName"
                  params={{ agentName: agent.name }}
                  className="rounded-md border border-white/10 p-1 text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{formatEnvironment(agent.environment)}</Badge>
                  <Badge variant="outline" className="border-cyan-300/30 text-cyan-200">
                    {agent.version ?? 'v0'}
                  </Badge>
                  <Badge
                    variant={agent.status === 'online' ? 'default' : 'outline'}
                    className={
                      agent.status === 'online' ? 'bg-emerald-500/20 text-emerald-200' : ''
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="truncate">Updated: {agent.updatedAt ?? 'n/a'}</p>
                  <p className="truncate">
                    Endpoint:{' '}
                    {agent.workerUrl ? (
                      <a
                        href={agent.workerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-primary hover:underline"
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
        <section className="mt-8 flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
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
