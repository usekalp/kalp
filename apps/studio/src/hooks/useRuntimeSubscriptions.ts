import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  subscribeAgent,
  subscribeAgentChatCapabilities,
  subscribeAgents,
  subscribeAgentState,
  subscribeAgentContracts,
  subscribeAgentEntrypoints,
  subscribeAgentRoutes,
  subscribeAgentTriggers,
  subscribeChatSession,
  subscribeChatSessions,
  subscribeExecutions,
  subscribeExecutionEvents,
  subscribeRuntimeSystem,
} from '#/lib/runtime/subscriptions'
import { sendChatMessage } from '#/lib/runtime/chat'

export function useRuntimeAgents() {
  return useQuery(subscribeAgents())
}

export function useRuntimeSystem() {
  return useQuery(subscribeRuntimeSystem())
}

export function useRuntimeAgent(agentName: string) {
  return useQuery(subscribeAgent(agentName))
}

export function useRuntimeAgentState(agentName: string) {
  return useQuery(subscribeAgentState(agentName))
}

export function useRuntimeAgentEntrypoints(agentName: string) {
  return useQuery(subscribeAgentEntrypoints(agentName))
}

export function useRuntimeAgentRoutes(agentName: string) {
  return useQuery(subscribeAgentRoutes(agentName))
}

export function useRuntimeAgentTriggers(agentName: string) {
  return useQuery(subscribeAgentTriggers(agentName))
}

export function useRuntimeAgentContracts(agentName: string) {
  return useQuery(subscribeAgentContracts(agentName))
}

export function useRuntimeAgentChatCapabilities(agentName: string) {
  return useQuery(subscribeAgentChatCapabilities(agentName))
}

export function useRuntimeExecutions(agentName?: string) {
  return useQuery(subscribeExecutions(agentName))
}

export function useRuntimeExecutionEvents(executionId: string, agentName?: string) {
  return useQuery(subscribeExecutionEvents(executionId, agentName))
}

export function useRuntimeChatSessions(agentName: string) {
  return useQuery(subscribeChatSessions(agentName))
}

export function useRuntimeChatSession(agentName: string, sessionId: string) {
  return useQuery(subscribeChatSession(agentName, sessionId))
}

export function useSendAgentChatMessage(agentName: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { message: string; sessionId?: string; stream?: boolean }) =>
      sendChatMessage({
        agentName,
        message: input.message,
        sessionId: input.sessionId,
        stream: input.stream,
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['runtime-agent', agentName],
        }),
        queryClient.invalidateQueries({
          queryKey: ['runtime-chat-sessions', agentName],
        }),
        queryClient.invalidateQueries({
          queryKey: ['runtime-chat-session', agentName, result.session.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['runtime-agent-executions', agentName],
        }),
      ])
    },
  })
}
