import { useQuery } from '@tanstack/react-query'
import { getAgentState } from '../services'

export function useAgentState(agentName: string) {
  return useQuery({
    queryKey: ['agent-state', agentName],
    queryFn: () => getAgentState(agentName),
    retry: false,
    enabled: !!agentName,
  })
}
