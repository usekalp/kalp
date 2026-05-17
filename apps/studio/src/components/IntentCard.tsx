import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
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

export function IntentCard({ event, index, isActive, onClick }: IntentCardProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={`cursor-pointer transition-all hover:scale-[1.01] ${
              isActive ? 'border-primary ring-1 ring-primary' : ''
            }`}
            onClick={onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                <Badge variant={resolveVariant(event.type)} className="text-xs">
                  {formatType(event.type)}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </CardHeader>
            <CardContent className="space-y-1 p-3 pt-0">
              <p className="truncate text-xs text-zinc-200">
                {JSON.stringify(event.payload ?? {}).slice(0, 120)}
              </p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                Execution {event.executionId}
              </p>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs font-medium">{event.type}</p>
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-zinc-200">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
