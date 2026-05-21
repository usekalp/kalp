import { AnimatedPage } from '../animated-page'
import { AiProviderSelector } from '#/features/settings/components/ai-provider-selector'

export function SettingsAiView() {
  return (
    <AnimatedPage>
      <AiProviderSelector currentProvider="openai" onChange={() => {}} />
    </AnimatedPage>
  )
}
