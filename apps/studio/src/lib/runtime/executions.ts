import type { ExecutionEvent, ExecutionSummary } from '#/types/events'
import { runtimeRequest } from './request'

export function getExecutions(agentName?: string): Promise<ExecutionSummary[]> {
  if (agentName) {
    return runtimeRequest(`/agents/${encodeURIComponent(agentName)}/executions`, {
      method: 'GET',
    })
  }

  return runtimeRequest('/executions', { method: 'GET' })
}

export function getExecution(executionId: string, agentName: string): Promise<ExecutionSummary> {
  return runtimeRequest(
    `/agents/${encodeURIComponent(agentName)}/executions/${encodeURIComponent(executionId)}`,
    { method: 'GET' },
  )
}

export function getExecutionEvents(
  executionId: string,
  options: { agentName?: string } = {},
): Promise<ExecutionEvent[]> {
  if (options.agentName) {
    return runtimeRequest(
      `/agents/${encodeURIComponent(options.agentName)}/executions/${encodeURIComponent(executionId)}/events`,
      { method: 'GET' },
    )
  }

  return runtimeRequest(`/events/${encodeURIComponent(executionId)}`, { method: 'GET' })
}
