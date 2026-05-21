import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayoutView } from '../views/settings-layout'

export const Route = createFileRoute('/_studio/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return <SettingsLayoutView />
}

