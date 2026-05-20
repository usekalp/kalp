import { Link, Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_studio/settings')({
  component: SettingsLayout,
})

const TABS = [
  { to: '/settings/secrets', label: 'Secrets' },
  { to: '/settings/ai', label: 'AI' },
  { to: '/settings/mcp', label: 'MCP' },
]

function SettingsLayout() {
  const location = useLocation()

  return (
    <div>
      <h1 className="mb-5 text-base font-medium tracking-tight text-white">
        Settings
      </h1>

      <div className="mb-6 flex gap-1 border-b border-zinc-800">
        {TABS.map((tab) => {
          const isActive = location.pathname === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'border-white/30 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
