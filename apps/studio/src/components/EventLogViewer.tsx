/**
 * Virtualized list of event log entries.
 * Uses shadcn ScrollArea and Skeleton components.
 *
 * @module
 */

import { ScrollArea } from '#/components/ui/scroll-area'
import { Skeleton } from '#/components/ui/skeleton'
import { IntentCard } from './IntentCard'
import type { IntentEvent } from '#/types/events'

interface EventLogViewerProps {
  /** Array of intent events to display */
  events: IntentEvent[] | undefined
  /** Currently selected sequence number */
  currentSeq: number
  /** Loading state */
  isLoading?: boolean
  /** Callback when an event is clicked */
  onSeek: (seq: number) => void
}

/**
 * Displays a scrollable list of intent events.
 * Highlights the currently selected event and allows seeking.
 */
export function EventLogViewer({
  events,
  currentSeq,
  isLoading,
  onSeek,
}: EventLogViewerProps) {
  if (isLoading) {
    return (
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </ScrollArea>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center text-muted-foreground">
        No events found
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-12rem)]">
      <div className="space-y-2 p-4">
        {events.map((event) => (
          <IntentCard
            key={`${event.executionId}-${event.seq}`}
            event={event}
            isActive={event.seq === currentSeq}
            onClick={() => onSeek(event.seq)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
