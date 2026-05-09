/**
 * Authentication hook for the Kalp Studio.
 * Captures JWT token from URL query param and stores it.
 *
 * @module
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'

/**
 * Hook to manage authentication via JWT token.
 * Token can come from URL (CLI magic link) or localStorage.
 */
export function useAuth(): {
  token: string | null
  isAuthenticated: boolean
} {
  const [token, setToken] = useState<string | null>(null)
  const search = useSearch({ from: '/' })
  const navigate = useNavigate()

  useEffect(() => {
    // 1. Try to read from URL (Magic Link from CLI)
    const urlToken = search.token
    if (urlToken) {
      localStorage.setItem('kalp_token', urlToken)
      setToken(urlToken)
      navigate({ to: '/', search: {} })
      return
    }

    // 2. Try to read from localStorage
    const stored = localStorage.getItem('kalp_token')
    if (stored) {
      // Validate expiration (decode without verification)
      try {
        const payload = JSON.parse(atob(stored.split('.')[1]))
        if (payload.exp > Date.now() / 1000) {
          setToken(stored)
        } else {
          localStorage.removeItem('kalp_token')
        }
      } catch {
        localStorage.removeItem('kalp_token')
      }
    }
  }, [search.token, navigate])

  return { token, isAuthenticated: !!token }
}
