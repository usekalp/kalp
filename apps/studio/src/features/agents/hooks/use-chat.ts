import { useQuery } from '@tanstack/react-query'
import { getChatSessions, getChatMessages } from '../services'

export function useChatSessions(agentName: string) {
  return useQuery({
    queryKey: ['chat-sessions', agentName],
    queryFn: () => getChatSessions(agentName),
    retry: false,
    enabled: !!agentName,
  })
}

export function useChatMessages(agentName: string, sessionId: string | null) {
  return useQuery({
    queryKey: ['chat-messages', agentName, sessionId],
    queryFn: () => getChatMessages(agentName, sessionId!),
    retry: false,
    enabled: !!agentName && !!sessionId,
  })
}
