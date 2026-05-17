import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, RadioTower, Route as RouteIcon, ShieldCheck } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { useRuntimeAgent } from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/agent/$agentName/triggers')({
  component: AgentTriggersPage,
})

function AgentTriggersPage() {
  const { agentName } = Route.useParams()
  const agentQuery = useRuntimeAgent(agentName)
  const agent = agentQuery.data

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <Card className="studio-tile rounded-[5px] xl:col-span-1">
        <CardHeader>
          <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
            <RouteIcon className="h-4 w-4 text-primary" />
            HTTP Routes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agentQuery.isLoading && <Skeleton className="h-40 w-full rounded-[5px]" />}
          {agent?.routes.map((route) => (
            <div key={route.id} className="rounded-[5px] border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-100">{route.path}</span>
                <Badge variant="outline" className="border-white/10 text-zinc-300">
                  {route.method}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                {route.public ? 'Public route' : 'Authenticated route'}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="studio-tile rounded-[5px] xl:col-span-1">
        <CardHeader>
          <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            Triggers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agentQuery.isLoading && <Skeleton className="h-40 w-full rounded-[5px]" />}
          {agent?.triggers.map((trigger) => (
            <div key={trigger.id} className="rounded-[5px] border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium capitalize text-zinc-100">{trigger.type}</span>
                <Badge variant="outline" className="border-white/10 text-zinc-300">
                  {trigger.stableName ?? trigger.id}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400">
                {trigger.expression ?? trigger.event ?? 'No trigger metadata'}
              </p>
              {trigger.timezone ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                  Timezone {trigger.timezone}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="studio-tile rounded-[5px] xl:col-span-1">
        <CardHeader>
          <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
            <RadioTower className="h-4 w-4 text-primary" />
            Contracts & Listeners
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agentQuery.isLoading && <Skeleton className="h-40 w-full rounded-[5px]" />}
          {agent?.contracts.map((contract) => (
            <div key={contract.id} className="rounded-[5px] border border-white/10 bg-black/25 p-3">
              <p className="font-medium text-zinc-100">{contract.name ?? contract.stableName ?? contract.id}</p>
              <p className="mt-1 text-xs text-zinc-400">Contract</p>
            </div>
          ))}
          {agent?.listeners.map((listener) => (
            <div key={listener.id} className="rounded-[5px] border border-white/10 bg-black/25 p-3">
              <p className="font-medium text-zinc-100">{listener.event}</p>
              <p className="mt-1 text-xs text-zinc-400">{listener.stableName ?? listener.id}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
