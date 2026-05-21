import { MemoryStick, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '#/ui/card'
import { Skeleton } from '#/ui/skeleton'
import type { RuntimeAgentState } from '../types'

interface StateSummaryProps {
  state: RuntimeAgentState | undefined
  isLoading: boolean
}

export function StateSummary({ state, isLoading }: StateSummaryProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2 text-base">
              <MemoryStick className="h-4 w-4 text-primary" />
              State Snapshot Surface
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 w-full rounded-xl">
              <Skeleton />
            </div>
          ) : (
            <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#0A0A0A] p-4 text-xs text-zinc-100">
              {JSON.stringify(
                state?.snapshot ?? { unavailable: true },
                null,
                2,
              )}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-primary" />
              State Capability
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            {isLoading ? (
              <>
                <div className="h-5 w-40">
                  <Skeleton />
                </div>
                <div className="h-20 w-full">
                  <Skeleton />
                </div>
              </>
            ) : (
              <>
                <p>
                  Schema reference:{' '}
                  <span className="text-zinc-100">
                    {state?.schemaId ?? 'none'}
                  </span>
                </p>
                <p>
                  Last updated:{' '}
                  <span className="text-zinc-100">
                    {state?.updatedAt ?? 'n/a'}
                  </span>
                </p>
                <div className="grid gap-3">
                  {state?.summary.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-3"
                    >
                      <p className="text-[10px] uppercase tracking-tighter text-zinc-500">
                        {item.key}
                      </p>
                      <p className="mt-1 text-sm text-zinc-100">{item.value}</p>
                    </div>
                  ))}
                </div>
                {!state?.availability.supported ? (
                  <div className="rounded-xl border border-amber-400/15 bg-amber-400/10 p-3 text-amber-100">
                    {state?.availability.reason}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
