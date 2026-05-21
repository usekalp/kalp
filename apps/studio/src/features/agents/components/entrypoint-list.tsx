import { CalendarClock } from 'lucide-react'
import type { RuntimeEntrypoint } from '../types'
import { ENTRYPOINT_ICONS, METHOD_COLORS } from '#/features/agents/constants'
import CopyButton from '#/features/shared/ui/copy-button'

interface EntrypointListProps {
  entrypoints: RuntimeEntrypoint[]
  agentName: string
}

export function EntrypointList({ entrypoints, agentName: _agentName }: EntrypointListProps) {
  if (entrypoints.length === 0) {
    return (
      <p className="text-xs text-zinc-500">No entrypoints configured.</p>
    )
  }

  return (
    <div className="space-y-2">
      {entrypoints.map((entry) => {
        const iconConfig = ENTRYPOINT_ICONS[entry.kind] ?? {
          icon: CalendarClock,
          color: 'bg-zinc-500/10 text-zinc-400',
        }
        const Icon = iconConfig.icon
        const color = iconConfig.color

        const friendlyDescription =
          entry.kind === 'route'
            ? `${entry.method ?? ''} ${entry.path ?? ''}`
            : entry.kind === 'listener'
              ? `Listens for ${entry.stableName ?? entry.id}`
              : entry.kind === 'hook'
                ? `Message hook handler`
                : `Contract handler`

        return (
          <div
            key={entry.id}
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/[0.02] px-3 py-3 transition-all hover:border-zinc-700 hover:bg-white/[0.03]"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">
                {entry.title}
              </p>
              <p className="text-xs text-zinc-500">
                {friendlyDescription}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-2 group-hover:flex">
              <CopyButton text={entry.path ?? entry.stableName ?? entry.id} />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {entry.method ? (
                <span
                  className={`rounded-xl px-2 py-0.5 text-[11px] font-mono font-medium ${
                    METHOD_COLORS[entry.method] ??
                    'bg-zinc-500/10 text-zinc-400'
                  }`}
                >
                  {entry.method}
                </span>
              ) : null}
              <code className="text-[11px] text-zinc-600">
                {entry.path ?? entry.stableName ?? entry.id}
              </code>
            </div>
          </div>
        )
      })}
    </div>
  )
}
