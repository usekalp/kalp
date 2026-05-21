import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight, Search, Filter, Bot } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Label,
} from '@/ui'
import { Skeleton } from '@/ui/skeleton'
import { useRuntimeAgents } from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/')({
  validateSearch: z.object({
    status: z.string().catch(''),
    tags: z.string().catch(''),
  }),
  component: DashboardPage,
})

const STATUSES = ['online', 'offline'] as const

function DashboardPage() {
  const agentsQuery = useRuntimeAgents()
  const agents = agentsQuery.data?.agents ?? []
  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const [query, setQuery] = useState('')

  const activeStatuses = useMemo(
    () =>
      searchParams.status ? searchParams.status.split(',').filter(Boolean) : [],
    [searchParams.status],
  )
  const activeTags = useMemo(
    () =>
      searchParams.tags ? searchParams.tags.split(',').filter(Boolean) : [],
    [searchParams.tags],
  )

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    agents.forEach((a) => a.tags?.forEach((t) => tags.add(t)))
    return Array.from(tags)
  }, [agents])

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (query) {
        const q = query.toLowerCase()
        const name = (a.label ?? a.name).toLowerCase()
        if (!name.includes(q)) return false
      }
      if (activeStatuses.length > 0 && !activeStatuses.includes(a.status))
        return false
      if (activeTags.length > 0 && !a.tags?.some((t) => activeTags.includes(t)))
        return false
      return true
    })
  }, [agents, query, activeStatuses, activeTags])

  const filteredOnline = filtered.filter((a) => a.status === 'online').length

  const toggleStatus = (value: string) => {
    const next = activeStatuses.includes(value)
      ? activeStatuses.filter((s) => s !== value)
      : [...activeStatuses, value]
    navigate({ search: { ...searchParams, status: next.join(',') } })
  }

  const toggleTag = (value: string) => {
    const next = activeTags.includes(value)
      ? activeTags.filter((t) => t !== value)
      : [...activeTags, value]
    navigate({ search: { ...searchParams, tags: next.join(',') } })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-medium tracking-tight text-white">
          Agents
        </h1>
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/8 bg-white/7 text-[11px] font-medium text-zinc-500">
          {filteredOnline}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-80 space-y-1.5">
          <Label>Search Agents</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents..."
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="space-y-1.5">
            <Label>Filter by Status</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-55 justify-start gap-2 text-muted-foreground!"
                >
                  {activeStatuses.length > 0 ? (
                    <>
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/8 text-[10px] text-muted-foreground">
                        {activeStatuses.length}
                      </span>
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    </>
                  ) : (
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  Any
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUSES.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={activeStatuses.includes(s)}
                    onCheckedChange={() => toggleStatus(s)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-1.5">
            <Label>Filter by Tags</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-55 justify-start gap-2 text-muted-foreground!"
                >
                  {activeTags.length > 0 ? (
                    <>
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/8 text-[10px] text-muted-foreground">
                        {activeTags.length}
                      </span>
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    </>
                  ) : (
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  Any
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {allTags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag}
                    checked={activeTags.includes(tag)}
                    onCheckedChange={() => toggleTag(tag)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {tag}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {agentsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-white/2 p-4"
            >
              <div className="mb-3 h-5 w-32">
                <Skeleton />
              </div>
              <div className="mb-2 h-3 w-full">
                <Skeleton />
              </div>
              <div className="mb-4 h-3 w-3/4">
                <Skeleton />
              </div>
              <div className="h-3 w-20">
                <Skeleton />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 justify-center rounded-xl border border-dashed border-zinc-800 py-20">
          <Bot className="w-10 h-10 text-zinc-500" />
          <p className="text-sm text-zinc-500">
            {query || activeStatuses.length > 0 || activeTags.length > 0
              ? 'No agents match your filters.'
              : 'No agents found. Push or sync agents to populate the runtime.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <Link
              key={agent.name}
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
          ))}
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
