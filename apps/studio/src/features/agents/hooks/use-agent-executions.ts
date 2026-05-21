import { useQuery } from '@tanstack/react-query'
import { getExecutions } from '../services'

export function useAgentExecutions(agentName: string) {
  return useQuery({
    queryKey: ['executions', agentName],
    queryFn: () => getExecutions(agentName),
    retry: false,
    enabled: !!agentName,
  })
}
