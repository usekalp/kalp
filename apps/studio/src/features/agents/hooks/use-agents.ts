import { useQuery } from '@tanstack/react-query'
import { getAgents } from '../services'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
    retry: false,
  })
}
