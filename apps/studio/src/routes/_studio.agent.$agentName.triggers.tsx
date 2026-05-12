import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/_studio/agent/$agentName/triggers')({
  component: AgentTriggersPage,
})

function AgentTriggersPage() {
  const { agentName } = Route.useParams()
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle>Triggers · {agentName}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Triggers panel stub. Próximo paso: listar entrypoints/schedules desde IR.
      </CardContent>
    </Card>
  )
}
