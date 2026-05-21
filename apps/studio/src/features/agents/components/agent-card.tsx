import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { formatRelativeTime } from '#/features/agents/utils/relative-time'

export interface AgentCardAgent {
  name: string
  label?: string
  description?: string
  tags?: string[]
  status: 'online' | 'offline'
  version?: string | null
  updatedAt?: string | null
}

interface AgentCardProps {
  agent: AgentCardAgent
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      to="/agent/$agentName"
      params={{ agentName: agent.name }}
      className="group relative block rounded-xl border border-neutral-900 bg-white/2 p-4 transition-all hover:border-neutral-800"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className="truncate text-sm font-medium text-white">
            {agent.label ?? agent.name}
          </h3>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
              agent.status === 'online'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-zinc-500/10 text-zinc-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                agent.status === 'online'
                  ? 'bg-emerald-400'
                  : 'bg-zinc-500'
              }`}
            />
            {agent.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {agent.label && agent.label !== agent.name ? (
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          {agent.name}
        </p>
      ) : null}

      {agent.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
          {agent.description}
        </p>
      ) : null}

      {agent.tags && agent.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-white/05 pt-3">
        <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-500">
          {agent.version ?? 'v0'}
        </span>
        <span className="text-[11px] text-zinc-600">
          Updated{' '}
          {agent.updatedAt
            ? formatRelativeTime(agent.updatedAt)
            : 'n/a'}
        </span>
      </div>

      <div className="absolute right-3 top-3 rounded-xl border border-zinc-800 bg-[#0A0A0A] p-1.5 text-zinc-500 opacity-0 transition-all duration-200 group-hover:opacity-100 -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  )
}
