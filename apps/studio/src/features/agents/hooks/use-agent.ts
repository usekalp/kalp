import { useQuery } from '@tanstack/react-query'
import {
  getAgent,
  getAgentEntrypoints,
  getAgentRoutes,
  getAgentTriggers,
  getAgentContracts,
  getAgentChatCapabilities,
} from '../services'

export function useAgent(agentName: string) {
  return useQuery({
    queryKey: ['agent', agentName],
    queryFn: () => getAgent(agentName),
    retry: false,
    enabled: !!agentName,
  })
}

export function useAgentEntrypoints(agentName: string) {
  return useQuery({
    queryKey: ['agent-entrypoints', agentName],
    queryFn: () => getAgentEntrypoints(agentName),
    retry: false,
    enabled: !!agentName,
  })
}

export function useAgentRoutes(agentName: string) {
  return useQuery({
    queryKey: ['agent-routes', agentName],
    queryFn: () => getAgentRoutes(agentName),
    retry: false,
    enabled: !!agentName,
  })
}

export function useAgentTriggers(agentName: string) {
  return useQuery({
    queryKey: ['agent-triggers', agentName],
    queryFn: () => getAgentTriggers(agentName),
    retry: false,
    enabled: !!agentName,
  })
}

export function useAgentContracts(agentName: string) {
  return useQuery({
    queryKey: ['agent-contracts', agentName],
    queryFn: () => getAgentContracts(agentName),
    retry: false,
    enabled: !!agentName,
  })
}

export function useAgentChatCapabilities(agentName: string) {
  return useQuery({
    queryKey: ['agent-chat-capabilities', agentName],
    queryFn: () => getAgentChatCapabilities(agentName),
    retry: false,
    enabled: !!agentName,
  })
}
