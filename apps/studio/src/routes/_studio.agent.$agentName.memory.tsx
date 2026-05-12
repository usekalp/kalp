import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/_studio/agent/$agentName/memory')({
  component: AgentMemoryPage,
})

function AgentMemoryPage() {
  const { agentName } = Route.useParams()
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle>Memory · {agentName}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Memory panel stub. Conectar con storage real del agente en siguiente iteración.
      </CardContent>
    </Card>
  )
}
