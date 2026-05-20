import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_studio/settings/')({
  loader: () => {
    throw redirect({ to: '/settings/secrets' })
  },
})
