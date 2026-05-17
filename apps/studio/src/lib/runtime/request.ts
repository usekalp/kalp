const API_BASE = '/api/internal'

type ApiRequestOptions = RequestInit & {
  skipUnauthorizedRedirect?: boolean
}

export async function runtimeRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (response.status === 401 && !options.skipUnauthorizedRedirect) {
    if (typeof window !== 'undefined') {
      window.location.href = '/studio/login'
    }
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}
