import { createFileRoute } from '@tanstack/react-router'
import { AgentStateView } from '../views/agent-state'

export const Route = createFileRoute('/_studio/agent/$agentName/state')({
  component: AgentState,
})

function AgentState() {
  return <AgentStateView />
}

