import { createFileRoute } from '@tanstack/react-router'
import { AgentActivityView } from '../views/agent-activity'

export const Route = createFileRoute('/_studio/agent/$agentName/activity')({
  component: AgentActivity,
})

function AgentActivity() {
  return <AgentActivityView />
}

