import { createFileRoute } from '@tanstack/react-router'
import { MembersView } from '../views/members'

export const Route = createFileRoute('/_studio/members')({
  component: MembersPage,
})

function MembersPage() {
  return <MembersView />
}

