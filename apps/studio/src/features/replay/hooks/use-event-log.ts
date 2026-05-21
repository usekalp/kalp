import { useQuery } from '@tanstack/react-query'
import { getExecutionEvents } from '../services'

export function useEventLog(executionId: string, agentName?: string) {
  return useQuery({
    queryKey: ['execution-events', executionId],
    queryFn: () => getExecutionEvents(executionId, { agentName }),
    retry: false,
    enabled: !!executionId,
  })
}
