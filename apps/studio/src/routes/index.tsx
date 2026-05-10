import { useMemo } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Globe, House, LogOut } from 'lucide-react'
import { getAgents } from '#/lib/api'
import { signOut, useAuth } from '#/hooks/useAuth'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const response = await fetch('/api/internal/session', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { username } = useAuth()
  const agentsQuery = useQuery({
    queryKey: ['runtime-agents'],
    queryFn: getAgents,
    retry: false,
  })

  const cards = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data])

  const onLogout = async () => {
    await signOut()
    window.location.href = '/studio/login'
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <header className="mx-auto mb-8 flex w-full max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img
            src="/studio/kalp-logo.png"
            alt="Kalp"
            className="h-10 w-10 rounded-lg border border-white/10 bg-black/50 p-1.5"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Kalp Studio
            </p>
            <h1 className="text-xl font-semibold">Agents Dashboard</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-white/20 bg-white/5">
            {username ?? 'guest'}
          </Badge>
          <Button variant="ghost" onClick={onLogout} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              className="group border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{formatEnvironment(agent.environment)}</Badge>
                  <Badge
                    variant={agent.status === 'online' ? 'default' : 'outline'}
                    className={
                      agent.status === 'online'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : ''
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="truncate">Hash: {agent.hash ?? 'n/a'}</p>
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
        <section className="mx-auto mt-8 flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
          <House className="mb-4 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-medium">No agents found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an agent with <code>kalp create</code> and push it to populate
            this dashboard.
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
