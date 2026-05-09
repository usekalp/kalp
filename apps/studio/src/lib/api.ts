/**
 * HTTP client for the Kalp Studio API.
 * Automatically includes Bearer token from localStorage.
 *
 * @module
 */

import type { ExecutionSummary, IntentEvent } from '#/types/events'

const API_BASE = '/api/internal'

/**
 * Get the stored JWT token.
 */
function getToken(): string | null {
  return localStorage.getItem('kalp_token')
}

/**
 * Make an authenticated API request.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch recent executions from the global D1 index.
 */
export async function fetchExecutions(): Promise<ExecutionSummary[]> {
  return apiRequest('/executions')
}

/**
 * Fetch event log for a specific execution from the DO.
 */
export async function fetchEventLog(
  executionId: string,
  threadId: string,
): Promise<IntentEvent[]> {
  return apiRequest(
    `/events/${executionId}?threadId=${encodeURIComponent(threadId)}`,
  )
}
