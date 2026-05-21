import { createFileRoute } from '@tanstack/react-router'
import { SettingsAiView } from '../views/settings-ai'

export const Route = createFileRoute('/_studio/settings/ai')({
  component: AiSettingsPage,
})

function AiSettingsPage() {
  return <SettingsAiView />
}

