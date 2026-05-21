import { useParams } from '@tanstack/react-router'
import { ChatInterface } from '#/features/agents/components/chat-interface'
import { useAgent } from '#/features/agents/hooks/use-agent'
import { AnimatedPage } from '../animated-page'
import AgentChatSkeleton from './agent-chat-skeleton'

export function AgentChatView() {
  const { agentName } = useParams({ from: '/_studio/agent/$agentName' })
  const agentQuery = useAgent(agentName)

  if (agentQuery.isLoading) return <AgentChatSkeleton />

  return (
    <AnimatedPage>
      <ChatInterface agentName={agentName} />
    </AnimatedPage>
  )
}

