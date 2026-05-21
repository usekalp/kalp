import type { ExecutionSummary } from '../types'

interface ExecutionHeaderProps {
  execution: ExecutionSummary | undefined
  isLoading: boolean
}

export function ExecutionHeader({ execution, isLoading }: ExecutionHeaderProps) {
  if (isLoading) {
    return (
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-48 animate-pulse rounded bg-zinc-800" />
            <div className="mt-1 h-4 w-64 animate-pulse rounded bg-zinc-800" />
          </div>
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="border-b border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Execution not found.</p>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    running: 'text-yellow-400',
    completed: 'text-emerald-400',
    error: 'text-red-400',
  }

  return (
    <div className="border-b border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Execution Replay</h1>
          <p className="font-mono text-sm text-muted-foreground">{execution.id}</p>
        </div>
        <div className="text-right text-sm">
          <p className={statusColors[execution.status] ?? 'text-muted-foreground'}>
            {execution.status}
          </p>
          {execution.startedAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(execution.startedAt).toLocaleString()}
            </p>
          )}
          {execution.error && (
            <p className="mt-1 max-w-xs truncate text-xs text-red-400" title={execution.error}>
              {execution.error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
