import { createFileRoute } from '@tanstack/react-router'
import { AgentChatView } from '../views/agent-chat'

export const Route = createFileRoute('/_studio/agent/$agentName/chat')({
  component: AgentChat,
})

function AgentChat() {
  return <AgentChatView />
}

