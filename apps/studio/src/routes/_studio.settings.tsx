import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SettingsTabs } from '#/components/SettingsTabs'

export const Route = createFileRoute('/_studio/settings')({
  component: SettingsLayout,
})

const TABS = [
  { to: '/settings/secrets', label: 'Secrets' },
  { to: '/settings/ai', label: 'AI' },
  { to: '/settings/mcp', label: 'MCP' },
]

function SettingsLayout() {
  return (
    <div>
      <h1 className="mb-5 text-base font-medium tracking-tight text-white">
        Settings
      </h1>

      <SettingsTabs tabs={TABS} />

      <Outlet />
    </div>
  )
}
