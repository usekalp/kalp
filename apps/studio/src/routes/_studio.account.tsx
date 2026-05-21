import { createFileRoute } from '@tanstack/react-router'
import { AccountView } from '../views/account'

export const Route = createFileRoute('/_studio/account')({
  component: AccountPage,
})

function AccountPage() {
  return <AccountView />
}

