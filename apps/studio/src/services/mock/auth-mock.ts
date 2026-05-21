let mockSession: {
  authenticated: boolean
  user: { username: string }
} | null = null

export async function mockLogin(input: {
  username?: string
  password?: string
}) {
  const username = input?.username ?? 'admin'
  mockSession = { authenticated: true, user: { username } }
  return { ok: true, user: { username } } as const
}

export async function mockGetSession() {
  if (!mockSession) return { authenticated: false } as const
  return mockSession
}

export async function mockLogout() {
  mockSession = null
  return { ok: true } as const
}
