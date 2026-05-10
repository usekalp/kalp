import { useQuery } from '@tanstack/react-query'
import { getSession, logout } from '#/lib/api'

export function useSession() {
  return useQuery({
    queryKey: ['studio-session'],
    queryFn: getSession,
    retry: false,
    refetchOnWindowFocus: true,
  })
}

export function useAuth() {
  const sessionQuery = useSession()

  return {
    sessionQuery,
    isAuthenticated: !!sessionQuery.data?.authenticated,
    username: sessionQuery.data?.user?.username ?? null,
  }
}

export async function signOut() {
  await logout()
}
