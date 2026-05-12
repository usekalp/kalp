import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Globe, MemoryStick, Server, Sparkles } from 'lucide-react'
import { getAgent } from '#/lib/api'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

export const Route = createFileRoute('/_studio/agent/$agentName')({
  component: AgentDetailPage,
})

const MOCK_ENTRY_POINTS = [
  { name: 'onMessage', method: 'POST', path: '/a/:agentName' },
  { name: 'onSchedule', method: 'CRON', path: '*/5 * * * *' },
]

const MOCK_MEMORY = {
  tickets_open: 14,
  conversations_active: 5,
  faq_cache_hit_rate: '91%',
}

function AgentDetailPage() {
  const { agentName } = Route.useParams()

  const agentQuery = useQuery({
    queryKey: ['runtime-agent', agentName],
    queryFn: () => getAgent(agentName),
    retry: false,
  })

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img
            src="/studio/kalp-logo.png"
            alt="Kalp"
            className="h-9 w-9 rounded-lg border border-white/10 bg-black/50 p-1"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Agent</p>
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
            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  Runtime Summary
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
                    variant={agentQuery.data.status === 'online' ? 'default' : 'outline'}
                    className={
                      agentQuery.data.status === 'online' ? 'bg-emerald-500/20 text-emerald-200' : ''
                    }
                  >
                    {agentQuery.data.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Version</span>
                  <Badge variant="outline" className="border-cyan-300/30 text-cyan-200">
                    {agentQuery.data.version ?? 'v0'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Updated</span>
                  <span>{agentQuery.data.updatedAt ?? 'n/a'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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

            <Card className="border-white/10 bg-white/[0.03] md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Available Entry Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Path / Schedule</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_ENTRY_POINTS.map((entry) => (
                      <TableRow key={entry.name}>
                        <TableCell className="font-medium">{entry.name}</TableCell>
                        <TableCell>{entry.method}</TableCell>
                        <TableCell>{entry.path}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.03] md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-primary" />
                  Memory / State
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-cyan-100">
                  {JSON.stringify(MOCK_MEMORY, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </main>
  )
}
