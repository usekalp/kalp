import { createFileRoute } from '@tanstack/react-router'
import { SettingsSecretsView } from '../views/settings-secrets'

export const Route = createFileRoute('/_studio/settings/secrets')({
  component: SecretsPage,
})

function SecretsPage() {
  return <SettingsSecretsView />
}

