export interface SessionData {
  authenticated: boolean
  user?: { username: string }
}

export interface AuthenticatedSession extends SessionData {
  authenticated: true
  user: { username: string }
}

export type SessionResponse = AuthenticatedSession | { authenticated: false }
