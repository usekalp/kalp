import { createFileRoute } from '@tanstack/react-router'
import { ReplayView } from '../views/replay'

export const Route = createFileRoute('/replay/$executionId')({
  component: ReplayPage,
})

function ReplayPage() {
  return <ReplayView />
}

