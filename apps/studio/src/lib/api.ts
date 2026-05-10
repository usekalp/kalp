import type { RuntimeAgent, RuntimeAgentsResponse } from '#/types/agents'
import type { ExecutionSummary, IntentEvent } from '#/types/events'

const API_BASE = '/api/internal'

type ApiRequestOptions = RequestInit & {
  skipUnauthorizedRedirect?: boolean
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (response.status === 401 && !options.skipUnauthorizedRedirect) {
    if (typeof window !== 'undefined') {
      window.location.href = '/studio/login'
    }
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export interface SessionResponse {
  authenticated: boolean
  user?: { username: string }
}

export async function login(input: {
  username?: string
  password: string
}): Promise<{ ok: true; user: { username: string } }> {
  return apiRequest('/auth', {
    method: 'POST',
    body: JSON.stringify(input),
    skipUnauthorizedRedirect: true,
  })
}

export async function logout(): Promise<{ ok: true }> {
  return apiRequest('/logout', {
    method: 'POST',
  })
}

export async function getSession(): Promise<SessionResponse> {
  return apiRequest('/session', {
    method: 'GET',
    skipUnauthorizedRedirect: true,
  })
}

export async function getAgents(): Promise<RuntimeAgentsResponse> {
  return apiRequest('/agents', { method: 'GET' })
}

export async function getAgent(name: string): Promise<RuntimeAgent> {
  return apiRequest(`/agents/${encodeURIComponent(name)}`, { method: 'GET' })
}

// Legacy Replay endpoints (kept for compatibility)
export async function fetchExecutions(): Promise<ExecutionSummary[]> {
  return apiRequest('/executions')
}

export async function fetchEventLog(
  executionId: string,
  threadId: string,
): Promise<IntentEvent[]> {
  return apiRequest(
    `/events/${executionId}?threadId=${encodeURIComponent(threadId)}`,
  )
}
