import type { ChatMessage, ChatSession } from '#/types/agents'
import { runtimeRequest } from './request'

export function getChatSessions(agentName: string): Promise<ChatSession[]> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/chat/sessions`, {
    method: 'GET',
  })
}

export function getChatMessages(
  agentName: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  return runtimeRequest(
    `/agents/${encodeURIComponent(agentName)}/chat/${encodeURIComponent(sessionId)}/messages`,
    { method: 'GET' },
  )
}

export function sendChatMessage(input: {
  agentName: string
  message: string
  sessionId?: string
  stream?: boolean
}): Promise<{
  session: ChatSession
  executionId: string
  message: ChatMessage
  stream: boolean
}> {
  return runtimeRequest(`/agents/${encodeURIComponent(input.agentName)}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message: input.message,
      sessionId: input.sessionId,
      stream: input.stream ?? false,
    }),
  })
}
