import { useQuery } from '@tanstack/react-query'
import { getSession } from '../services'

export function useSession() {
  return useQuery({
    queryKey: ['studio-session'],
    queryFn: getSession,
    retry: false,
    refetchOnWindowFocus: true,
  })
}
