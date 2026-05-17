import type { RuntimeAgent, RuntimeAgentsResponse } from '#/types/agents'
import type { ExecutionEvent, ExecutionSummary } from '#/types/events'
import { getAgent, getAgents } from './runtime/agents'
import { getExecutionEvents, getExecutions } from './runtime/executions'
import { runtimeRequest } from './runtime/request'

export interface SessionResponse {
  authenticated: boolean
  user?: { username: string }
}

export async function login(input: {
  username?: string
  password: string
}): Promise<{ ok: true; user: { username: string } }> {
  return runtimeRequest('/auth', {
    method: 'POST',
    body: JSON.stringify(input),
    skipUnauthorizedRedirect: true,
  })
}

export async function logout(): Promise<{ ok: true }> {
  return runtimeRequest('/logout', {
    method: 'POST',
  })
}

export async function getSession(): Promise<SessionResponse> {
  return runtimeRequest('/session', {
    method: 'GET',
    skipUnauthorizedRedirect: true,
  })
}

export { getAgents, getAgent }

export async function fetchExecutions(): Promise<ExecutionSummary[]> {
  return getExecutions()
}

export async function fetchEventLog(
  executionId: string,
  threadId?: string,
): Promise<ExecutionEvent[]> {
  void threadId
  return getExecutionEvents(executionId)
}

export type { RuntimeAgent, RuntimeAgentsResponse }
