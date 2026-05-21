import { CalendarClock, Globe, RadioTower, Zap } from 'lucide-react'
import { Skeleton } from '#/ui/skeleton'
import { METHOD_COLORS } from '#/features/agents/constants'
import type { RuntimeRoute, RuntimeTrigger, RuntimeListener } from '../types'

interface TopologyViewProps {
  routes: RuntimeRoute[] | undefined
  triggers: RuntimeTrigger[] | undefined
  listeners: RuntimeListener[] | undefined
  isLoading: boolean
}

export function TopologyView({
  routes,
  triggers,
  listeners,
  isLoading,
}: TopologyViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-zinc-500" />
          <h2 className="text-xs font-medium text-white">HTTP Routes</h2>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 w-full">
              <Skeleton />
            </div>
            <div className="h-12 w-full">
              <Skeleton />
            </div>
          </div>
        ) : !routes || routes.length === 0 ? (
          <p className="text-xs text-zinc-500">No HTTP routes configured.</p>
        ) : (
          <div className="space-y-2">
            {routes.map((route) => (
              <div
                key={route.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/2 px-3 py-2.5 transition-colors hover:bg-white/2"
              >
                <span
                  className={`rounded-xl px-2 py-0.5 text-[11px] font-mono font-medium ${
                    METHOD_COLORS[route.method] ??
                    'bg-zinc-500/10 text-zinc-400'
                  }`}
                >
                  {route.method}
                </span>
                <code className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                  {route.path}
                </code>
                <span className="shrink-0 text-[11px] text-zinc-600">
                  {route.public ? 'Public' : 'Authenticated'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-zinc-500" />
          <h2 className="text-xs font-medium text-white">
            Triggers & Listeners
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 w-full">
              <Skeleton />
            </div>
            <div className="h-12 w-full">
              <Skeleton />
            </div>
          </div>
        ) : (!triggers || triggers.length === 0) &&
          (!listeners || listeners.length === 0) ? (
          <p className="text-xs text-zinc-500">
            No triggers or listeners configured.
          </p>
        ) : (
          <div className="space-y-2">
            {triggers?.map((trigger) => (
              <div
                key={trigger.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/2 px-3 py-2.5 transition-colors hover:bg-white/2"
              >
                <CalendarClock className="h-4 w-4 shrink-0 text-purple-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium capitalize text-white">
                    {trigger.type}
                  </p>
                  {trigger.expression ? (
                    <code className="text-[11px] text-zinc-500">
                      {trigger.expression}
                    </code>
                  ) : null}
                </div>
                {trigger.timezone ? (
                  <span className="shrink-0 text-[11px] text-zinc-600">
                    {trigger.timezone}
                  </span>
                ) : null}
              </div>
            ))}
            {listeners?.map((listener) => (
              <div
                key={listener.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/2 px-3 py-2.5 transition-colors hover:bg-white/2"
              >
                <Zap className="h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">
                    {listener.event}
                  </p>
                  <code className="text-[11px] text-zinc-500">
                    {listener.stableName ?? listener.id}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
