import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '#/features/auth/services'
import { StudioLayoutView } from '../views/studio-layout'

export const Route = createFileRoute('/_studio')({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    if (!session.authenticated) {
      const redirectTo = location.pathname
      throw redirect({ to: '/login', search: { redirectTo } })
    }
  },
  component: StudioShell,
})

function StudioShell() {
  return <StudioLayoutView />
}

