import { useQuery } from '@tanstack/react-query'
import { getMembers } from '../services'
import type { TeamMember } from '../types'

export function useMembers() {
  const { data: members = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: getMembers as () => Promise<TeamMember[]>,
  })

  return { members }
}
