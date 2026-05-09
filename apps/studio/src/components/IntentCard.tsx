/**
 * Card component displaying an IntentEvent.
 * Uses shadcn Card, Badge, and Tooltip components.
 *
 * @module
 */

import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { IntentEvent } from '#/types/events'

interface IntentCardProps {
  /** The intent event to display */
  event: IntentEvent
  /** Whether this event is currently selected/highlighted */
  isActive?: boolean
  /** Click handler for seeking to this event */
  onClick?: () => void
}

/**
 * Displays a single intent event as a card.
 * Shows event type, sequence number, and status.
 */
export function IntentCard({ event, isActive, onClick }: IntentCardProps) {
  const getStatusColor = () => {
    if (event.error) return 'destructive'
    if (event.status === 'waiting') return 'secondary'
    return 'default'
  }

  const formatType = (type: string) => {
    return type.replace('intent.', '').replace(/_/g, ' ')
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={`cursor-pointer transition-all hover:scale-[1.02] ${
              isActive ? 'border-primary ring-1 ring-primary' : ''
            }`}
            onClick={onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  #{event.seq}
                </span>
                <Badge variant={getStatusColor()} className="text-xs">
                  {formatType(event.type)}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {event.result !== undefined && (
                <p className="text-xs text-muted-foreground truncate">
                  Result: {JSON.stringify(event.result).slice(0, 50)}
                </p>
              )}
              {event.error && (
                <p className="text-xs text-destructive truncate">
                  Error: {event.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">Execution: {event.executionId}</p>
          <p className="text-xs">Trace: {event.traceId}</p>
          {event.payload !== undefined && event.payload !== null && (
            <p className="text-xs max-w-xs truncate">
              Payload: {JSON.stringify(event.payload)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
