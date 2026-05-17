import { useRuntimeExecutionEvents, useRuntimeExecutions } from './useRuntimeSubscriptions'

export function useExecutions(agentName?: string) {
  return useRuntimeExecutions(agentName)
}

export function useEventLog(executionId: string, agentName?: string) {
  return useRuntimeExecutionEvents(executionId, agentName)
}
