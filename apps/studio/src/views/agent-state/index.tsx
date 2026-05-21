import { useParams } from '@tanstack/react-router'
import { StateSummary } from '#/features/agents/components/state-summary'
import { useAgentState } from '#/features/agents/hooks/use-agent-state'
import { AnimatedPage } from '../animated-page'
import AgentStateSkeleton from './agent-state-skeleton'

export function AgentStateView() {
  const { agentName } = useParams({ from: '/_studio/agent/$agentName' })
  const stateQuery = useAgentState(agentName)

  if (stateQuery.isLoading) return <AgentStateSkeleton />

  return (
    <AnimatedPage>
      <StateSummary state={stateQuery.data} isLoading={false} />
    </AnimatedPage>
  )
}

