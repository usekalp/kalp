import type {
  RuntimeAgentDetails,
  RuntimeAgentsResponse,
  RuntimeAgentState,
  RuntimeChatCapabilities,
  RuntimeContract,
  RuntimeEntrypoint,
  RuntimeRoute,
  RuntimeTrigger,
} from '#/types/agents'
import { runtimeRequest } from './request'

export function getAgents(): Promise<RuntimeAgentsResponse> {
  return runtimeRequest('/agents', { method: 'GET' })
}

export function getAgent(agentName: string): Promise<RuntimeAgentDetails> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}`, { method: 'GET' })
}

export function getAgentEntrypoints(agentName: string): Promise<RuntimeEntrypoint[]> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/entrypoints`, { method: 'GET' })
}

export function getAgentRoutes(agentName: string): Promise<RuntimeRoute[]> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/routes`, { method: 'GET' })
}

export function getAgentTriggers(agentName: string): Promise<RuntimeTrigger[]> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/triggers`, { method: 'GET' })
}

export function getAgentContracts(agentName: string): Promise<RuntimeContract[]> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/contracts`, { method: 'GET' })
}

export function getAgentState(agentName: string): Promise<RuntimeAgentState> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/state`, { method: 'GET' })
}

export function getAgentChatCapabilities(agentName: string): Promise<RuntimeChatCapabilities> {
  return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/chat-capabilities`, {
    method: 'GET',
  })
}
