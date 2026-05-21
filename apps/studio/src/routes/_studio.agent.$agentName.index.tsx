import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  CalendarClock,
  Globe,
  MessageSquareText,
  Server,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Skeleton } from '@/ui/skeleton'
import { Button } from '@/ui/button'
import { useRuntimeAgent } from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/agent/$agentName/')({
  component: AgentOverviewPage,
})

const ENTRYPOINT_ICONS: Record<string, { icon: typeof Globe; color: string }> =
  {
    route: { icon: Globe, color: 'bg-blue-500/10 text-blue-400' },
    hook: {
      icon: MessageSquareText,
      color: 'bg-purple-500/10 text-purple-400',
    },
    listener: { icon: Zap, color: 'bg-amber-500/10 text-amber-400' },
    contract: { icon: Sparkles, color: 'bg-indigo-500/10 text-indigo-400' },
  }

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-400',
  DELETE: 'bg-red-500/10 text-red-400',
}

function AgentOverviewPage() {
  const { agentName } = Route.useParams()
  const agentQuery = useRuntimeAgent(agentName)
  const agent = agentQuery.data

  const recentEntrypoints = useMemo(() => agent?.entrypoints ?? [], [agent])
  const stats = agent?.executionStats

  return (
    <div className="space-y-6">
      {agentQuery.isLoading ? (
        <div className="flex gap-6">
          <div className="h-16 flex-1">
            <Skeleton />
          </div>
          <div className="h-16 flex-1">
            <Skeleton />
          </div>
          <div className="h-16 flex-1">
            <Skeleton />
          </div>
          <div className="h-16 flex-1">
            <Skeleton />
          </div>
        </div>
      ) : agent ? (
        <>
          <section className="flex gap-6">
            <div>
              <p className="kpi-value">{stats?.total ?? 0}</p>
              <p className="kpi-label inline-flex items-center gap-1">
                <Zap className="h-3 w-3" /> Executions
              </p>
            </div>
            <div>
              <p className="kpi-value">{stats?.successful ?? 0}</p>
              <p className="kpi-label inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Successful
              </p>
            </div>
            <div>
              <p className="kpi-value">{stats?.failed ?? 0}</p>
              <p className="kpi-label inline-flex items-center gap-1">
                <Activity className="h-3 w-3" /> Failed
              </p>
            </div>
            <div>
              <p className="kpi-value">{recentEntrypoints.length}</p>
              <p className="kpi-label inline-flex items-center gap-1">
                <Server className="h-3 w-3" /> Entrypoints
              </p>
            </div>
          </section>

          <section>
            {recentEntrypoints.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No entrypoints configured.
              </p>
            ) : (
              <div className="space-y-2">
                {recentEntrypoints.map((entry) => {
                  const iconConfig = ENTRYPOINT_ICONS[entry.kind] ?? {
                    icon: CalendarClock,
                    color: 'bg-zinc-500/10 text-zinc-400',
                  }
                  const Icon = iconConfig.icon
                  const color = iconConfig.color

                  const friendlyDescription =
                    entry.kind === 'route'
                      ? `${entry.method ?? ''} ${entry.path ?? ''}`
                      : entry.kind === 'listener'
                        ? `Listens for ${entry.stableName ?? entry.id}`
                        : entry.kind === 'hook'
                          ? `Message hook handler`
                          : `Contract handler`

                  return (
                    <div
                      key={entry.id}
                      className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/[0.02] px-3 py-3 transition-all hover:border-zinc-700 hover:bg-white/[0.03]"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">
                          {entry.title}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {friendlyDescription}
                        </p>
                      </div>

                      <div className="hidden shrink-0 items-center gap-2 group-hover:flex">
                        <Button variant="ghost" size="icon" title="Copy">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </Button>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {entry.method ? (
                          <span
                            className={`rounded-xl px-2 py-0.5 text-[11px] font-mono font-medium ${
                              METHOD_COLORS[entry.method] ??
                              'bg-zinc-500/10 text-zinc-400'
                            }`}
                          >
                            {entry.method}
                          </span>
                        ) : null}
                        <code className="text-[11px] text-zinc-600">
                          {entry.path ?? entry.stableName ?? entry.id}
                        </code>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Agent not found.</p>
      )}
    </div>
  )
}
