import type {
  RuntimeAgentDetails,
  RuntimeAgentsResponse,
  RuntimeAgentState,
  RuntimeChatCapabilities,
  RuntimeContract,
  RuntimeEntrypoint,
  RuntimeRoute,
  RuntimeTrigger,
  RuntimeSystemStatus,
} from '#/types/agents'
import { httpClient } from '#/services/api/http-client'

export function getAgents(): Promise<RuntimeAgentsResponse> {
  return httpClient.get('/agents')
}

export function getAgent(agentName: string): Promise<RuntimeAgentDetails> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}`)
}

export function getAgentEntrypoints(agentName: string): Promise<RuntimeEntrypoint[]> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}/entrypoints`)
}

export function getAgentRoutes(agentName: string): Promise<RuntimeRoute[]> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}/routes`)
}

export function getAgentTriggers(agentName: string): Promise<RuntimeTrigger[]> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}/triggers`)
}

export function getAgentContracts(agentName: string): Promise<RuntimeContract[]> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}/contracts`)
}

export function getAgentState(agentName: string): Promise<RuntimeAgentState> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}/state`)
}

export function getAgentChatCapabilities(agentName: string): Promise<RuntimeChatCapabilities> {
  return httpClient.get(`/agents/${encodeURIComponent(agentName)}/chat-capabilities`)
}

export function getRuntimeSystemStatus(): Promise<RuntimeSystemStatus> {
  return httpClient.get('/runtime/system')
}
