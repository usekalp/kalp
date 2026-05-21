import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginView } from '../views/login'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirectTo: z.string().catch(''),
  }),
  component: LoginPage,
})

function LoginPage() {
  return <LoginView />
}

