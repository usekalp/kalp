import { useQuery } from '@tanstack/react-query'
import { HardDrive } from 'lucide-react'
import { getMcpServers } from '../services'

export function McpList() {
  const { data: servers = [] } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: getMcpServers,
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Active Model Context Protocol connections for this workspace.
      </p>

      {servers.length === 0 ? (
        <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-white/2 px-6 py-12 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_60%)]" />
          <div className="relative mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-white/4">
            <HardDrive className="h-6 w-6 text-zinc-500" />
          </div>
          <h3 className="mb-1 text-sm font-medium text-white">
            No MCP servers detected
          </h3>
          <p className="mx-auto mb-6 max-w-sm text-xs leading-relaxed text-zinc-500">
            Model Context Protocol servers extend your agent's capabilities with
            external tools and data sources. Configure them in your project
            configuration.
          </p>
          <div className="mx-auto inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/40 px-4 py-2.5 font-mono text-xs text-zinc-400">
            <span>
              Configure MCP servers in your{' '}
              <code className="font-mono text-zinc-500">kalp.config.ts</code>
            </span>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {servers.map((mcp: any) => (
            <div
              key={mcp.name}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/2 p-3"
            >
              <HardDrive className="h-4 w-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white">{mcp.name}</p>
                <code className="block truncate text-[11px] text-zinc-600">
                  {mcp.url}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
