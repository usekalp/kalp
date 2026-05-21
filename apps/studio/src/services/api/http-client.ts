const API_BASE = '/api/internal'

type ApiRequestOptions = RequestInit & {
  skipUnauthorizedRedirect?: boolean
}

async function request<T>(
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

  if (response.status === 401) {
    if (options.skipUnauthorizedRedirect) {
      return response.json()
    }
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

export const httpClient = {
  get: <T>(endpoint: string, options?: ApiRequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: ApiRequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}
