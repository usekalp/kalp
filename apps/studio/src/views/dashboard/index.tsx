import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { AgentSearch } from '#/features/agents/components/agent-search'
import { AgentFilters } from '#/features/agents/components/agent-filters'
import { AgentGrid } from '#/features/agents/components/agent-grid'
import { useAgents } from '#/features/agents/hooks/use-agents'
import { Label } from '#/ui'
import { AnimatedPage } from '../animated-page'
import DashboardSkeleton from './dashboard-skeleton'

export function DashboardView() {
  const agentsQuery = useAgents()
  const navigate = useNavigate()
  const searchParams = useSearch({ from: '/_studio/' })
  const [query, setQuery] = useState('')
  const agents = agentsQuery.data?.agents ?? []

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

  const onStatusChange = (next: string[]) => {
    navigate({
      to: '/',
      search: { status: next.join(','), tags: searchParams.tags },
    })
  }

  const onTagChange = (next: string[]) => {
    navigate({
      to: '/',
      search: { status: searchParams.status, tags: next.join(',') },
    })
  }

  if (agentsQuery.isLoading) return <DashboardSkeleton />

  const filteredOnline = filtered.filter((a) => a.status === 'online').length

  return (
    <AnimatedPage>
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
            <AgentSearch value={query} onChange={setQuery} />
          </div>
          <AgentFilters
            statuses={activeStatuses}
            tags={activeTags}
            allTags={allTags}
            onStatusChange={onStatusChange}
            onTagChange={onTagChange}
          />
        </div>

        <AgentGrid agents={filtered} isLoading={agentsQuery.isLoading} />
      </div>
    </AnimatedPage>
  )
}
