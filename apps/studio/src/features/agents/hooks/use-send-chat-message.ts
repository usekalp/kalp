import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendChatMessage } from '../services'

export function useSendChatMessage(agentName: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { message?: string; sessionId?: string; stream?: boolean }) =>
      sendChatMessage({ ...input, agentName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentName] })
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', agentName] })
      queryClient.invalidateQueries({ queryKey: ['chat-messages', agentName] })
      queryClient.invalidateQueries({ queryKey: ['executions', agentName] })
    },
  })
}
