import { useParams } from '@tanstack/react-router'
import { ActivityTimeline } from '#/features/agents/components/activity-timeline'
import { AnimatedPage } from '../animated-page'

export function AgentActivityView() {
  const { agentName } = useParams({ from: '/_studio/agent/$agentName' })

  return (
    <AnimatedPage>
      <ActivityTimeline agentName={agentName} />
    </AnimatedPage>
  )
}

