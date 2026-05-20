import { createFileRoute } from '@tanstack/react-router'
import { HardDrive } from 'lucide-react'

export const Route = createFileRoute('/_studio/settings/mcp')({
  component: McpSettingsPage,
})

const MOCK_MCP = [
  { name: 'deepwiki', url: 'https://mcp.deepwiki.com/sse' },
  { name: 'filesystem', url: 'local:/mcp/fs' },
]

function McpSettingsPage() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Active Model Context Protocol connections for this workspace.
      </p>

      {MOCK_MCP.length === 0 ? (
        <p className="text-xs text-zinc-500">No MCP servers configured.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {MOCK_MCP.map((mcp) => (
            <div
              key={mcp.name}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/[0.02] p-3"
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

      <p className="text-xs text-zinc-600">
        Configure MCP servers in your{' '}
        <code className="font-mono text-zinc-500">kalp.config.ts</code>
      </p>
    </div>
  )
}
