import { ScrollArea } from '@/ui/scroll-area'
import { Skeleton } from '@/ui/skeleton'
import { IntentCard } from './IntentCard'
import type { ExecutionEvent } from '#/types/events'

interface EventLogViewerProps {
  events: ExecutionEvent[] | undefined
  currentSeq: number
  isLoading?: boolean
  onSeek: (seq: number) => void
}

export function EventLogViewer({
  events,
  currentSeq,
  isLoading,
  onSeek,
}: EventLogViewerProps) {
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)]">
        <ScrollArea>
          <div className="space-y-2 p-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-16 w-full">
                <Skeleton />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center text-muted-foreground">
        No execution events recorded yet.
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-12rem)]">
      <ScrollArea>
        <div className="space-y-2 p-4">
          {events.map((event, index) => (
            <IntentCard
              key={event.id}
              event={event}
              index={index}
              isActive={index + 1 === currentSeq}
              onClick={() => onSeek(index + 1)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
