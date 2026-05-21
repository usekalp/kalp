import { useState, useCallback, useEffect } from 'react'
import type { ReplayState } from '../types'

interface UseReplayOptions {
  totalEvents: number
  initialSpeed?: number
}

export function useReplay({ totalEvents, initialSpeed = 1 }: UseReplayOptions) {
  const [currentSeq, setCurrentSeq] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(initialSpeed)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentSeq((prev) => {
        if (prev >= totalEvents) {
          setIsPlaying(false)
          return totalEvents
        }
        return prev + 1
      })
    }, 1000 / speed)
    return () => clearInterval(interval)
  }, [isPlaying, speed, totalEvents])

  const play = useCallback(() => setIsPlaying(true), [])
  const pause = useCallback(() => setIsPlaying(false), [])
  const step = useCallback(() => setCurrentSeq((p) => Math.min(p + 1, totalEvents)), [totalEvents])
  const seek = useCallback((seq: number) => setCurrentSeq(Math.max(1, Math.min(seq, totalEvents))), [totalEvents])

  return { currentSeq, totalEvents, isPlaying, speed, play, pause, step, seek, setSpeed } as ReplayState & { play: () => void; pause: () => void; step: () => void; seek: (seq: number) => void; setSpeed: (s: number) => void }
}
