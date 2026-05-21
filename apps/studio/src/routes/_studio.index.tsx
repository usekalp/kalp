import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { z } from 'zod'
import { DashboardView } from '../views/dashboard'

const defaultStudioSearch = {
  status: '',
  tags: '',
  search: '',
} as const

export const Route = createFileRoute('/_studio/')({
  validateSearch: z.object({
    status: z.string().catch(defaultStudioSearch.status),
    tags: z.string().catch(defaultStudioSearch.tags),
    search: z.string().catch(defaultStudioSearch.search),
  }),
  search: {
    middlewares: [stripSearchParams(defaultStudioSearch)],
  },
  component: StudioIndex,
})

function StudioIndex() {
  return <DashboardView />
}

