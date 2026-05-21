import { createFileRoute } from '@tanstack/react-router'
import { SettingsMcpView } from '../views/settings-mcp'

export const Route = createFileRoute('/_studio/settings/mcp')({
  component: McpSettingsPage,
})

function McpSettingsPage() {
  return <SettingsMcpView />
}

