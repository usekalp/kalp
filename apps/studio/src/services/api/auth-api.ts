import { httpClient } from '#/services/api/http-client'

export async function login(input: {
  username?: string
  password: string
}): Promise<{ ok: true; user: { username: string } }> {
  return httpClient.post('/auth', input, { skipUnauthorizedRedirect: true })
}

export async function getSession(): Promise<{
  authenticated: boolean
  user?: { username: string }
}> {
  return httpClient.get('/session', {
    skipUnauthorizedRedirect: true,
  })
}

export async function logout(): Promise<{ ok: true }> {
  return httpClient.post('/logout')
}
