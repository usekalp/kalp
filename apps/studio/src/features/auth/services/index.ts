import { isMockMode } from '#/lib/mock-mode'
import type { SessionResponse } from '../types'
import { login as apiLogin, getSession as apiGetSession, logout as apiLogout } from '#/services/api/auth-api'
import { mockLogin, mockGetSession, mockLogout } from '#/services/mock/auth-mock'

const useMock = isMockMode()

export const login: typeof apiLogin = useMock
  ? (input) => mockLogin(input) as any
  : apiLogin

export const getSession: () => Promise<SessionResponse> = useMock
  ? () => mockGetSession() as Promise<SessionResponse>
  : () => apiGetSession() as Promise<SessionResponse>

export const logout: () => Promise<{ ok: true }> = useMock
  ? () => mockLogout() as Promise<{ ok: true }>
  : () => apiLogout()

export const signOut = logout

export type { SessionResponse } from '../types'
