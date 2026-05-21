import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'

export const Route = createFileRoute('/_studio/agent/$agentName')({
  component: AgentLayoutPage,
})

const VIEW_LABELS: Record<string, string> = {
  overview: 'Overview',
  activity: 'Activity',
  chat: 'Chat',
  state: 'State',
  topology: 'Topology',
  replay: 'Replay',
}

function AgentLayoutPage() {
  const { agentName } = Route.useParams()
  const location = useLocation()

  const pathWithoutPrefix = location.pathname
    .replace(`/agent/${agentName}`, '')
    .replace(/^\//, '')

  const viewKey =
    pathWithoutPrefix.length > 0 ? pathWithoutPrefix.split('/')[0] : 'overview'
  const viewLabel = VIEW_LABELS[viewKey] ?? viewKey

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      <header className="sticky top-12 z-20 flex h-12 items-center border-b border-zinc-800 bg-[#080A0A] px-6">
        <h1 className="text-sm font-medium text-white">
          {viewLabel}
        </h1>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
