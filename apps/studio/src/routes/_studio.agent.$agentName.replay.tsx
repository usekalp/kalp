import { createFileRoute, Link } from '@tanstack/react-router'
import { Activity, ArrowUpRight, Clock3, Radar } from 'lucide-react'
import { Badge } from '@kalphq/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@kalphq/ui/card'
import { Skeleton } from '@kalphq/ui/skeleton'
import { useRuntimeExecutions } from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/agent/$agentName/replay')({
  component: AgentReplayPage,
})

function AgentReplayPage() {
  const { agentName } = Route.useParams()
  const executionsQuery = useRuntimeExecutions(agentName)
  const executions = executionsQuery.data ?? []

  return (
    <Card className="rounded-5">
      <CardHeader>
        <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
          <Radar className="h-4 w-4 text-primary" />
          Executions & Replay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {executionsQuery.isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-5" />
          ))}

        {!executionsQuery.isLoading && executions.length === 0 ? (
          <div className="rounded-5 border border-white/10 bg-black/25 p-4 text-sm text-muted-foreground">
            No execution history recorded yet for this agent.
          </div>
        ) : null}

        {executions.map((execution) => (
          <div
            key={execution.id}
            className="rounded-5 border border-white/10 bg-black/25 p-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      execution.status === 'completed' ? 'default' : 'outline'
                    }
                    className={
                      execution.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : execution.status === 'error'
                          ? 'border-red-400/20 text-red-200'
                          : 'border-white/10 text-zinc-300'
                    }
                  >
                    <Activity className="mr-1 h-3 w-3" />
                    {execution.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-white/10 text-zinc-300"
                  >
                    {execution.id}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-100">
                  {formatTrigger(execution.trigger)}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {execution.startedAt ?? 'n/a'}
                  </span>
                  <span>Duration {execution.durationMs ?? 0} ms</span>
                </div>
                {execution.error ? (
                  <p className="text-sm text-red-200">{execution.error}</p>
                ) : execution.outputText ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {execution.outputText}
                  </p>
                ) : null}
              </div>

              <Link
                to="/replay/$executionId"
                params={{ executionId: execution.id }}
                className="inline-flex items-center rounded-5 border border-white/10 px-3 py-2 text-xs uppercase tracking-tightest text-zinc-300 hover:border-white/20 hover:text-white"
              >
                Open replay
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function formatTrigger(trigger: unknown) {
  if (!trigger) return 'Unknown trigger'
  if (typeof trigger === 'string') return trigger
  return JSON.stringify(trigger)
}
