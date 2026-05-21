import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DashboardView } from '../views/dashboard'

export const Route = createFileRoute('/_studio/')({
  validateSearch: z.object({
    status: z.string().catch(''),
    tags: z.string().catch(''),
  }),
  component: StudioIndex,
})

function StudioIndex() {
  return <DashboardView />
}

