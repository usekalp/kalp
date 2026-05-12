import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarClock, Cloud, Globe, MemoryStick, MessageSquareText, Server, Sparkles } from 'lucide-react'
import { getAgent } from '#/lib/api'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/_studio/agent/$agentName/')({
  component: AgentOverviewPage,
})

const MOCK_ENTRY_POINTS = [
  { name: 'onMessage', method: 'POST', path: '/a/:agentName', icon: MessageSquareText },
  { name: 'onSchedule', method: 'CRON', path: '*/5 * * * *', icon: CalendarClock },
]

const MOCK_MEMORY = {
  tickets_open: 14,
  conversations_active: 5,
  faq_cache_hit_rate: '91%',
}

function AgentOverviewPage() {
  const { agentName } = Route.useParams()

  const agentQuery = useQuery({
    queryKey: ['runtime-agent', agentName],
    queryFn: () => getAgent(agentName),
    retry: false,
  })

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {agentQuery.isLoading && (
        <>
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl md:col-span-2" />
        </>
      )}

      {agentQuery.data && (
        <>
          <Card className="studio-tile rounded-[5px]">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" />
                Runtime Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="rounded-[5px] border border-white/10 bg-black/20 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Environment</p>
                <div className="flex items-center gap-1 text-zinc-100">
                  <Cloud className="h-3.5 w-3.5" />
                  {agentQuery.data.environment}
                </div>
              </div>
              <div className="rounded-[5px] border border-white/10 bg-black/20 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Status</p>
                <Badge
                  variant={agentQuery.data.status === 'online' ? 'default' : 'outline'}
                  className={agentQuery.data.status === 'online' ? 'bg-emerald-500/20 text-emerald-200' : ''}
                >
                  <Activity className="mr-1 h-3 w-3" />
                  {agentQuery.data.status}
                </Badge>
              </div>
              <div className="rounded-[5px] border border-white/10 bg-black/20 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Version</p>
                <Badge variant="outline" className="border-slate-200/20 bg-white/[0.02] text-zinc-200">
                  {agentQuery.data.version ?? 'v0'}
                </Badge>
              </div>
              <div className="rounded-[5px] border border-white/10 bg-black/20 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Updated</p>
                <span className="text-zinc-300">{agentQuery.data.updatedAt ?? 'n/a'}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="studio-tile rounded-[5px]">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-primary" />
                Endpoint & Deploy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="truncate">Local path: {agentQuery.data.localPath ?? 'n/a'}</p>
              <p className="truncate">Hash: {agentQuery.data.hash ?? 'n/a'}</p>
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

          <Card className="studio-tile rounded-[5px] md:col-span-2">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Available Entry Points
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {MOCK_ENTRY_POINTS.map((entry) => {
                const Icon = entry.icon
                return (
                  <div
                    key={entry.name}
                    className="rounded-[5px] border border-white/10 bg-black/25 p-3 transition hover:border-white/20 hover:bg-black/35"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-zinc-300" />
                        <span className="font-medium text-zinc-100">{entry.name}</span>
                      </div>
                      <Badge variant="outline" className="border-white/10 text-zinc-300">
                        {entry.method}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400">{entry.path}</p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="studio-tile rounded-[5px] md:col-span-2">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <MemoryStick className="h-4 w-4 text-primary" />
                Memory / State
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(MOCK_MEMORY).map(([key, value], index) => (
                  <div key={key} className="rounded-[5px] border border-white/10 bg-black/25 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{key}</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-100">{String(value)}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-zinc-200/40 to-indigo-200/50"
                        style={{ width: `${Math.min(95, 35 + index * 22)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <details className="rounded-[5px] border border-white/10 bg-black/35 p-3">
                <summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Expand full state JSON
                </summary>
                <pre className="mt-3 overflow-x-auto font-mono text-xs text-zinc-200">
                  {JSON.stringify(MOCK_MEMORY, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
