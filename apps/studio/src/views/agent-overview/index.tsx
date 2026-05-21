import { useParams } from '@tanstack/react-router'
import { useAgent } from '#/features/agents/hooks/use-agent'
import { EntrypointList } from '#/features/agents/components/entrypoint-list'
import { Activity, Server, Sparkles, Zap } from 'lucide-react'
import { AnimatedPage } from '../animated-page'
import AgentOverviewSkeleton from './agent-overview-skeleton'

export function AgentOverviewView() {
  const { agentName } = useParams({ from: '/_studio/agent/$agentName' })
  const agentQuery = useAgent(agentName)
  const agent = agentQuery.data

  if (agentQuery.isLoading) return <AgentOverviewSkeleton />

  const entrypoints = agent?.entrypoints ?? []
  const stats = agent?.executionStats

  if (!agent) {
    return (
      <AnimatedPage>
        <p className="text-sm text-zinc-500">Agent not found.</p>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <div className="space-y-6">
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
            <p className="kpi-value">{entrypoints.length}</p>
            <p className="kpi-label inline-flex items-center gap-1">
              <Server className="h-3 w-3" /> Entrypoints
            </p>
          </div>
        </section>

        <EntrypointList entrypoints={entrypoints} agentName={agentName} />
      </div>
    </AnimatedPage>
  )
}

