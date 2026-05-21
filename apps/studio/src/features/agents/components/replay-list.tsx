import { Link } from '@tanstack/react-router'
import { Activity, ArrowUpRight, Clock3, Radar } from 'lucide-react'
import { Badge } from '#/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/ui/card'
import { Skeleton } from '#/ui/skeleton'
import { formatTrigger } from '#/features/agents/utils/format-trigger'

interface ExecutionSummary {
  id: string
  agentName: string
  trigger: unknown
  status: 'running' | 'completed' | 'error'
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  error: string | null
  outputText?: string
}

interface ReplayListProps {
  executions: ExecutionSummary[]
  isLoading: boolean
  agentName: string
}

export function ReplayList({ executions, isLoading, agentName: _agentName }: ReplayListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2 text-base">
            <Radar className="h-4 w-4 text-primary" />
            Executions & Replay
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading &&
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 w-full rounded-xl">
                <Skeleton />
              </div>
            ))}

          {!isLoading && executions.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-4 text-sm text-muted-foreground">
              No execution history recorded yet for this agent.
            </div>
          ) : null}

          {executions.map((execution) => (
            <div
              key={execution.id}
              className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        execution.status === 'error'
                          ? 'destructive'
                          : execution.status === 'completed'
                            ? 'default'
                            : 'outline'
                      }
                    >
                      <Activity className="mr-1 h-3 w-3" />
                      {execution.status}
                    </Badge>
                    <Badge variant="outline">{execution.id}</Badge>
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
                  className="inline-flex items-center rounded-xl border border-zinc-800 px-3 py-2 text-xs uppercase tracking-tightest text-zinc-300 hover:border-white/20 hover:text-white"
                >
                  Open replay
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
