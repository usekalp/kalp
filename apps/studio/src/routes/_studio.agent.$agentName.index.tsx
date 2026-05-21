import { createFileRoute } from '@tanstack/react-router'
import { AgentOverviewView } from '../views/agent-overview'

export const Route = createFileRoute('/_studio/agent/$agentName/')({
  component: AgentOverview,
})

function AgentOverview() {
  return <AgentOverviewView />
}

