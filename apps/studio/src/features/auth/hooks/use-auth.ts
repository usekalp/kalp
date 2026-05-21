import type { SessionResponse } from '../types'
import { useSession } from './use-session'
import { signOut } from '../services'

export function useAuth() {
  const sessionQuery = useSession()
  const data = sessionQuery.data as SessionResponse | undefined
  return {
    sessionQuery,
    isAuthenticated: data?.authenticated ?? false,
    username: data?.authenticated ? data.user.username : undefined,
  }
}

export { signOut }
