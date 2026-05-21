import { createFileRoute } from '@tanstack/react-router'
import { AgentLayoutView } from '../views/agent-layout'

export const Route = createFileRoute('/_studio/agent/$agentName')({
  component: StudioAgent,
})

function StudioAgent() {
  return <AgentLayoutView />
}

