import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/_studio/agent/$agentName/replay')({
  component: AgentReplayPage,
})

function AgentReplayPage() {
  const { agentName } = Route.useParams()
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle>Replay · {agentName}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Replay route contextual del agente (stub). Si querés, conecto este panel con
        `/{'{'}executionId{'}'}` real y selector de ejecuciones.
      </CardContent>
    </Card>
  )
}
