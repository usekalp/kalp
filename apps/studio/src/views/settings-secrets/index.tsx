import { AnimatedPage } from '../animated-page'
import { SecretsManager } from '#/features/settings/components/secrets-manager'

export function SettingsSecretsView() {
  return (
    <AnimatedPage>
      <SecretsManager />
    </AnimatedPage>
  )
}
