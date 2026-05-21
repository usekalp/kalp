import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '#/lib/utils'

interface Tab {
  to: string
  label: string
}

export function SettingsTabs({ tabs }: { tabs: Tab[] }) {
  const location = useLocation()

  return (
    <div className="mb-6 flex gap-1 border-b border-zinc-800">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.to
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'border-white/60 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
