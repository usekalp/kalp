/**
 * Hook to fetch and manage event log data.
 * Uses TanStack Query for caching and live reload.
 *
 * @module
 */

import { useQuery } from '@tanstack/react-query'
import { fetchEventLog, fetchExecutions } from '#/lib/api'
import type { ExecutionSummary, IntentEvent } from '#/types/events'

/**
 * Fetch recent executions from the global D1 index.
 */
export function useExecutions() {
  return useQuery<ExecutionSummary[]>({
    queryKey: ['executions'],
    queryFn: fetchExecutions,
    refetchInterval: 5000, // Poll every 5 seconds for new executions
  })
}

/**
 * Fetch event log for a specific execution.
 */
export function useEventLog(executionId: string, threadId: string) {
  return useQuery<IntentEvent[]>({
    queryKey: ['events', executionId],
    queryFn: () => fetchEventLog(executionId, threadId),
    refetchInterval: 1000, // Live reload if execution is active
    enabled: !!executionId && !!threadId,
  })
}
