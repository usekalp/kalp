import { createFileRoute } from '@tanstack/react-router'
import { MemoryStick, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { useRuntimeAgentState } from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/agent/$agentName/memory')({
  component: AgentMemoryPage,
})

function AgentMemoryPage() {
  const { agentName } = Route.useParams()
  const stateQuery = useRuntimeAgentState(agentName)
  const state = stateQuery.data

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="studio-tile rounded-[5px]">
        <CardHeader>
          <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
            <MemoryStick className="h-4 w-4 text-primary" />
            State Snapshot Surface
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stateQuery.isLoading ? (
            <Skeleton className="h-64 w-full rounded-[5px]" />
          ) : (
            <pre className="overflow-x-auto rounded-[5px] border border-white/10 bg-black/25 p-4 text-xs text-zinc-100">
              {JSON.stringify(state?.snapshot ?? { unavailable: true }, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card className="studio-tile rounded-[5px]">
        <CardHeader>
          <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-primary" />
            State Capability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {stateQuery.isLoading ? (
            <>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : (
            <>
              <p>
                Schema reference: <span className="text-zinc-100">{state?.schemaId ?? 'none'}</span>
              </p>
              <p>
                Last updated: <span className="text-zinc-100">{state?.updatedAt ?? 'n/a'}</span>
              </p>
              <div className="grid gap-3">
                {state?.summary.map((item) => (
                  <div key={item.key} className="rounded-[5px] border border-white/10 bg-black/25 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{item.key}</p>
                    <p className="mt-1 text-sm text-zinc-100">{item.value}</p>
                  </div>
                ))}
              </div>
              {!state?.availability.supported ? (
                <div className="rounded-[5px] border border-amber-400/15 bg-amber-400/10 p-3 text-amber-100">
                  {state?.availability.reason}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
