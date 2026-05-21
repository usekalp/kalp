import { createFileRoute } from '@tanstack/react-router'
import { AgentReplayView } from '../views/agent-replay'

export const Route = createFileRoute('/_studio/agent/$agentName/replay')({
  component: AgentReplay,
})

function AgentReplay() {
  return <AgentReplayView />
}

