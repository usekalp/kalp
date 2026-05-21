import { Activity, Sparkles, Zap } from 'lucide-react'
import { Skeleton } from '#/ui/skeleton'
import type { RuntimeAgentExecutionStats } from '../types'

interface ExecutionListProps {
  stats: RuntimeAgentExecutionStats | undefined
  entrypointCount: number
  isLoading: boolean
}

export function ExecutionList({ stats, entrypointCount, isLoading }: ExecutionListProps) {
  if (isLoading) {
    return (
      <div className="flex gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 flex-1">
            <Skeleton />
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="flex gap-6">
      <div>
        <p className="kpi-value">{stats?.total ?? 0}</p>
        <p className="kpi-label inline-flex items-center gap-1">
          <Zap className="h-3 w-3" /> Executions
        </p>
      </div>
      <div>
        <p className="kpi-value">{stats?.successful ?? 0}</p>
        <p className="kpi-label inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Successful
        </p>
      </div>
      <div>
        <p className="kpi-value">{stats?.failed ?? 0}</p>
        <p className="kpi-label inline-flex items-center gap-1">
          <Activity className="h-3 w-3" /> Failed
        </p>
      </div>
      <div>
        <p className="kpi-value">{entrypointCount}</p>
        <p className="kpi-label inline-flex items-center gap-1">
          <Zap className="h-3 w-3" /> Entrypoints
        </p>
      </div>
    </section>
  )
}
