import {
  getAgent,
  getAgentChatCapabilities,
  getAgentContracts,
  getAgentEntrypoints,
  getAgentRoutes,
  getAgents,
  getAgentState,
  getAgentTriggers,
} from './agents'
import { getChatMessages, getChatSessions } from './chat'
import { getExecutionEvents, getExecutions } from './executions'
import { getRuntimeSystemStatus } from './system'

export function subscribeAgents() {
  return {
    queryKey: ['runtime-agents'],
    queryFn: getAgents,
    retry: false,
  } as const
}

export function subscribeRuntimeSystem() {
  return {
    queryKey: ['runtime-system'],
    queryFn: getRuntimeSystemStatus,
    retry: false,
  } as const
}

export function subscribeAgent(agentName: string) {
  return {
    queryKey: ['runtime-agent', agentName],
    queryFn: () => getAgent(agentName),
    retry: false,
  } as const
}

export function subscribeAgentState(agentName: string) {
  return {
    queryKey: ['runtime-agent-state', agentName],
    queryFn: () => getAgentState(agentName),
    retry: false,
  } as const
}

export function subscribeExecutions(agentName?: string) {
  return {
    queryKey: agentName ? ['runtime-agent-executions', agentName] : ['runtime-executions'],
    queryFn: () => getExecutions(agentName),
    retry: false,
  } as const
}

export function subscribeExecutionEvents(executionId: string, agentName?: string) {
  return {
    queryKey: ['runtime-execution-events', agentName ?? 'global', executionId],
    queryFn: () => getExecutionEvents(executionId, { agentName }),
    retry: false,
    enabled: Boolean(executionId),
  } as const
}

export function subscribeChatSession(agentName: string, sessionId: string) {
  return {
    queryKey: ['runtime-chat-session', agentName, sessionId],
    queryFn: () => getChatMessages(agentName, sessionId),
    retry: false,
    enabled: Boolean(agentName) && Boolean(sessionId),
  } as const
}

export function subscribeChatSessions(agentName: string) {
  return {
    queryKey: ['runtime-chat-sessions', agentName],
    queryFn: () => getChatSessions(agentName),
    retry: false,
  } as const
}

export function subscribeAgentEntrypoints(agentName: string) {
  return {
    queryKey: ['runtime-agent-entrypoints', agentName],
    queryFn: () => getAgentEntrypoints(agentName),
    retry: false,
  } as const
}

export function subscribeAgentRoutes(agentName: string) {
  return {
    queryKey: ['runtime-agent-routes', agentName],
    queryFn: () => getAgentRoutes(agentName),
    retry: false,
  } as const
}

export function subscribeAgentTriggers(agentName: string) {
  return {
    queryKey: ['runtime-agent-triggers', agentName],
    queryFn: () => getAgentTriggers(agentName),
    retry: false,
  } as const
}

export function subscribeAgentContracts(agentName: string) {
  return {
    queryKey: ['runtime-agent-contracts', agentName],
    queryFn: () => getAgentContracts(agentName),
    retry: false,
  } as const
}

export function subscribeAgentChatCapabilities(agentName: string) {
  return {
    queryKey: ['runtime-agent-chat-capabilities', agentName],
    queryFn: () => getAgentChatCapabilities(agentName),
    retry: false,
  } as const
}
