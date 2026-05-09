/**
 * Hook to control replay playback state.
 * Manages play/pause, seeking, and speed.
 *
 * @module
 */

import { useState, useCallback, useEffect } from 'react'
import type { ReplayState } from '#/types/events'

interface UseReplayOptions {
  totalEvents: number
}

interface UseReplayReturn extends ReplayState {
  play: () => void
  pause: () => void
  step: (direction: 1 | -1) => void
  seek: (seq: number) => void
  setSpeed: (speed: ReplayState['speed']) => void
}

/**
 * Hook to manage replay playback controls.
 */
export function useReplay(options: UseReplayOptions): UseReplayReturn {
  const { totalEvents } = options
  
  const [state, setState] = useState<ReplayState>({
    currentSeq: 0,
    totalEvents,
    isPlaying: false,
    speed: 1,
  })

  // Update totalEvents when it changes
  useEffect(() => {
    setState(prev => ({ ...prev, totalEvents }))
  }, [totalEvents])

  // Auto-play logic
  useEffect(() => {
    if (!state.isPlaying) return

    const interval = setInterval(() => {
      setState(prev => {
        if (prev.currentSeq >= prev.totalEvents) {
          return { ...prev, isPlaying: false }
        }
        return { ...prev, currentSeq: prev.currentSeq + 1 }
      })
    }, 1000 / state.speed)

    return () => clearInterval(interval)
  }, [state.isPlaying, state.speed, state.totalEvents])

  const play = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: true }))
  }, [])

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }))
  }, [])

  const step = useCallback((direction: 1 | -1) => {
    setState(prev => ({
      ...prev,
      currentSeq: Math.max(0, Math.min(prev.totalEvents, prev.currentSeq + direction)),
      isPlaying: false,
    }))
  }, [])

  const seek = useCallback((seq: number) => {
    setState(prev => ({
      ...prev,
      currentSeq: Math.max(0, Math.min(prev.totalEvents, seq)),
      isPlaying: false,
    }))
  }, [])

  const setSpeed = useCallback((speed: ReplayState['speed']) => {
    setState(prev => ({ ...prev, speed }))
  }, [])

  return {
    ...state,
    play,
    pause,
    step,
    seek,
    setSpeed,
  }
}
