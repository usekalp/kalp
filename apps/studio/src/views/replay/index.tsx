import { useParams } from '@tanstack/react-router'
import { useAuth } from '#/features/auth/hooks/use-auth'
import { useEventLog } from '#/features/replay/hooks/use-event-log'
import { useReplay } from '#/features/replay/hooks/use-replay'
import { EventLogViewer } from '#/features/replay/components/event-log-viewer'
import { ReplayControls } from '#/features/replay/components/replay-controls'
import { ExecutionHeader } from '#/features/replay/components/execution-header'
import { Card, CardContent, CardHeader, CardTitle } from '#/ui/card'
import { AnimatedPage } from '../animated-page'
import ReplaySkeleton from './replay-skeleton'

export function ReplayView() {
  const { isAuthenticated, sessionQuery } = useAuth()
  const { executionId } = useParams({ from: '/replay/$executionId' })
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
    return <ReplaySkeleton />
  }

  return (
    <AnimatedPage>
    <div className="flex h-screen flex-col">
      <ExecutionHeader execution={undefined} isLoading={false} />

      <div className="flex-1 overflow-hidden">
        <EventLogViewer
          events={events}
          currentSeq={replay.currentSeq}
          isLoading={isLoading}
          onSeek={replay.seek}
        />
      </div>

      <ReplayControls
        state={{
          currentSeq: replay.currentSeq,
          isPlaying: replay.isPlaying,
          speed: replay.speed,
          totalEvents: events?.length ?? 0,
        }}
        onPlay={replay.play}
        onPause={replay.pause}
        onStep={replay.step}
        onSeek={replay.seek}
        onSpeedChange={replay.setSpeed}
      />
    </div>
    </AnimatedPage>
  )
}

