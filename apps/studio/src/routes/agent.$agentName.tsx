import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Globe, Hash, Server } from 'lucide-react'
import { getAgent } from '#/lib/api'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/agent/$agentName')({
  beforeLoad: async () => {
    const response = await fetch('/api/internal/session', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw redirect({ to: '/login' })
    }
  },
  component: AgentDetailPage,
})

function AgentDetailPage() {
  const { agentName } = Route.useParams()

  const agentQuery = useQuery({
    queryKey: ['runtime-agent', agentName],
    queryFn: () => getAgent(agentName),
    retry: false,
  })

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <header className="mx-auto mb-8 flex w-full max-w-5xl items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img
            src="/studio/kalp-logo.png"
            alt="Kalp"
            className="h-10 w-10 rounded-lg border border-white/10 bg-black/50 p-1.5"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Agent
            </p>
            <h1 className="text-xl font-semibold">{agentName}</h1>
          </div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center rounded-lg border border-white/15 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </header>

      <section className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
        {agentQuery.isLoading && (
          <>
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl md:col-span-2" />
          </>
        )}

        {agentQuery.data && (
          <>
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  Runtime
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Environment</span>
                  <Badge variant="secondary">{agentQuery.data.environment}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <Badge
                    variant={
                      agentQuery.data.status === 'online' ? 'default' : 'outline'
                    }
                    className={
                      agentQuery.data.status === 'online'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : ''
                    }
                  >
                    {agentQuery.data.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Updated</span>
                  <span>{agentQuery.data.updatedAt ?? 'n/a'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  Version
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="break-all">{agentQuery.data.hash ?? 'n/a'}</p>
                <p className="break-all">
                  Local Path: {agentQuery.data.localPath ?? 'n/a'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Endpoint
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {agentQuery.data.workerUrl ? (
                  <a
                    href={agentQuery.data.workerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-primary hover:underline"
                  >
                    {agentQuery.data.workerUrl}
                  </a>
                ) : (
                  <p>Agent has not been deployed yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </main>
  )
}
