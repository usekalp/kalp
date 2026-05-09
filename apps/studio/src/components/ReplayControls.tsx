/**
 * Playback controls for replay functionality.
 * Uses shadcn Button, Slider, and Select components.
 *
 * @module
 */

import { Button } from '#/components/ui/button'
import { Slider } from '#/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import type { ReplayState } from '#/types/events'

interface ReplayControlsProps {
  /** Current replay state */
  state: ReplayState
  /** Callbacks for control actions */
  onPlay: () => void
  onPause: () => void
  onStep: (direction: 1 | -1) => void
  onSeek: (seq: number) => void
  onSpeedChange: (speed: ReplayState['speed']) => void
}

/**
 * Playback control bar for replay functionality.
 * Includes play/pause, step buttons, progress slider, and speed selector.
 */
export function ReplayControls({
  state,
  onPlay,
  onPause,
  onStep,
  onSeek,
  onSpeedChange,
}: ReplayControlsProps) {
  return (
    <div className="flex items-center gap-4 border-t border-border bg-muted/50 p-4">
      {/* Play/Pause Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={state.isPlaying ? onPause : onPlay}
      >
        {state.isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Step Backward */}
      <Button variant="ghost" size="icon" onClick={() => onStep(-1)}>
        <SkipBack className="h-4 w-4" />
      </Button>

      {/* Progress Slider */}
      <div className="flex flex-1 items-center gap-4">
        <Slider
          value={[state.currentSeq]}
          max={state.totalEvents}
          min={0}
          step={1}
          onValueChange={([v]) => onSeek(v)}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground w-24 text-right font-mono">
          {state.currentSeq} / {state.totalEvents}
        </span>
      </div>

      {/* Step Forward */}
      <Button variant="ghost" size="icon" onClick={() => onStep(1)}>
        <SkipForward className="h-4 w-4" />
      </Button>

      {/* Speed Selector */}
      <Select
        value={state.speed.toString()}
        onValueChange={(v) => onSpeedChange(Number(v) as ReplayState['speed'])}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Speed" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0.5">0.5x</SelectItem>
          <SelectItem value="1">1x</SelectItem>
          <SelectItem value="2">2x</SelectItem>
          <SelectItem value="4">4x</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
