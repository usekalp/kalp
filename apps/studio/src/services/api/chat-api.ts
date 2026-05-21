import type { ChatMessage, ChatSession } from '#/types/agents'
import { httpClient } from '#/services/api/http-client'

export function getChatSessions(agentName: string): Promise<ChatSession[]> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}/chat/sessions`)
}

export function getChatMessages(agentName: string, sessionId: string): Promise<ChatMessage[]> {
  return httpClient.get(
    `/agents/${encodeURIComponent(agentName)}/chat/${encodeURIComponent(sessionId)}/messages`,
  )
}

export function sendChatMessage(input: {
  agentName: string
  message?: string
  sessionId?: string
  stream?: boolean
}): Promise<any> {
  return httpClient.post(`/agents/${encodeURIComponent(input.agentName)}/chat`, {
    message: input.message,
    sessionId: input.sessionId,
    stream: input.stream ?? false,
  })
}
