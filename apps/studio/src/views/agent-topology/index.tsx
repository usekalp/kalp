import { useParams } from '@tanstack/react-router'
import { TopologyView } from '#/features/agents/components/topology-view'
import { useAgent } from '#/features/agents/hooks/use-agent'
import { AnimatedPage } from '../animated-page'
import AgentTopologySkeleton from './agent-topology-skeleton'

export function AgentTopologyView() {
  const { agentName } = useParams({ from: '/_studio/agent/$agentName' })
  const agentQuery = useAgent(agentName)
  const agent = agentQuery.data

  if (agentQuery.isLoading) return <AgentTopologySkeleton />

  return (
    <AnimatedPage>
      <TopologyView
        routes={agent?.routes}
        triggers={agent?.triggers}
        listeners={agent?.listeners}
        isLoading={false}
      />
    </AnimatedPage>
  )
}

