import { createFileRoute } from '@tanstack/react-router'
import { AgentTopologyView } from '../views/agent-topology'

export const Route = createFileRoute('/_studio/agent/$agentName/topology')({
  component: AgentTopology,
})

function AgentTopology() {
  return <AgentTopologyView />
}

