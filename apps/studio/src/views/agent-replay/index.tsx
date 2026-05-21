import { useParams } from '@tanstack/react-router'
import { ReplayList } from '#/features/agents/components/replay-list'
import { useAgentExecutions } from '#/features/agents/hooks/use-agent-executions'
import { AnimatedPage } from '../animated-page'
import AgentReplaySkeleton from './agent-replay-skeleton'

export function AgentReplayView() {
  const { agentName } = useParams({ from: '/_studio/agent/$agentName' })
  const executionsQuery = useAgentExecutions(agentName)
  const executions = executionsQuery.data ?? []

  if (executionsQuery.isLoading) return <AgentReplaySkeleton />

  return (
    <AnimatedPage>
      <ReplayList
        executions={executions}
        isLoading={false}
        agentName={agentName}
      />
    </AnimatedPage>
  )
}

