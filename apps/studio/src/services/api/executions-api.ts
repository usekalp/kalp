import type { ExecutionEvent, ExecutionSummary } from '#/types/events'
import { httpClient } from '#/services/api/http-client'

export function getExecutions(agentName?: string): Promise<ExecutionSummary[]> {
  if (agentName) {
    return httpClient.get(`/agents/${encodeURIComponent(agentName)}/executions`)
  }
  return httpClient.get('/executions')
}

export function getExecution(executionId: string, agentName?: string): Promise<ExecutionSummary> {
  return httpClient.get(
    `/agents/${encodeURIComponent(agentName ?? '')}/executions/${encodeURIComponent(executionId)}`,
  )
}

export function getExecutionEvents(
  executionId: string,
  options?: { agentName?: string; threadId?: string },
): Promise<ExecutionEvent[]> {
  if (options?.agentName) {
    return httpClient.get(
      `/agents/${encodeURIComponent(options.agentName)}/executions/${encodeURIComponent(executionId)}/events`,
    )
  }
  return httpClient.get(`/events/${encodeURIComponent(executionId)}`)
}
