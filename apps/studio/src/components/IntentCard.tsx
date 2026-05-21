import { Badge } from '@/ui/badge'
import { Card, CardContent, CardHeader } from '@/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/tooltip'
import type { ExecutionEvent } from '#/types/events'

interface IntentCardProps {
  event: ExecutionEvent
  index: number
  isActive?: boolean
  onClick?: () => void
}

function resolveVariant(type: ExecutionEvent['type']) {
  if (type === 'error') return 'destructive'
  if (type === 'execution_started' || type === 'execution_finished') return 'secondary'
  return 'default'
}

function formatType(type: string) {
  return type.replace(/_/g, ' ')
}

export function IntentCard({ event, index, onClick }: IntentCardProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`cursor-pointer transition-all hover:scale-[1.01]`}
            onClick={onClick}
          >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                <Badge variant={resolveVariant(event.type)}>
                  {formatType(event.type)}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </CardHeader>
            <CardContent>
              <p className="truncate text-xs text-zinc-200">
                {JSON.stringify(event.payload ?? {}).slice(0, 120)}
              </p>
              <p className="text-3xs uppercase tracking-tightest text-zinc-500">
                Execution {event.executionId}
              </p>
            </CardContent>
          </Card>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs font-medium">{event.type}</p>
          <pre className="mt-2 whitespace-pre-wrap text-3xs text-zinc-200">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
