import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import { EventLogViewer } from '#/components/EventLogViewer'
import { ReplayControls } from '#/components/ReplayControls'
import { useEventLog } from '#/hooks/useEventLog'
import { useAuth } from '#/hooks/useAuth'
import { useReplay } from '#/hooks/useReplay'

export const Route = createFileRoute('/replay/$executionId')({
  component: ReplayPage,
})

function ReplayPage() {
  const { isAuthenticated, sessionQuery } = useAuth()
  const { executionId } = Route.useParams()
  const { data: events, isLoading } = useEventLog(executionId)
  const replay = useReplay({ totalEvents: events?.length ?? 0 })

  if (!sessionQuery.isLoading && !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please run <code>kalp dev</code> from your terminal to authenticate.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (sessionQuery.isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Execution Replay</h1>
            <p className="font-mono text-sm text-muted-foreground">{executionId}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{events?.length ?? 0} events</p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-hidden">
        <EventLogViewer
          events={events}
          currentSeq={replay.currentSeq}
          isLoading={isLoading}
          onSeek={replay.seek}
        />
      </div>

      <Separator />

      <ReplayControls
        state={replay}
        onPlay={replay.play}
        onPause={replay.pause}
        onStep={replay.step}
        onSeek={replay.seek}
        onSpeedChange={replay.setSpeed}
      />
    </div>
  )
}
