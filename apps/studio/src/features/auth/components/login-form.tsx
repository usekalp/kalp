import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useFormik } from 'formik'
import { z } from 'zod'
import { toFormikValidate } from 'zod-formik-adapter'

import { login } from '#/features/auth/services'
import { Button } from '#/ui/button'
import { Input } from '#/ui/input'
import { Label } from '#/ui/label'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

interface LoginFormProps {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)

  const formik = useFormik({
    initialValues: { username: '', password: '' },
    validate: toFormikValidate(loginSchema),
    onSubmit: async (values, { setSubmitting }) => {
      setError(null)
      try {
        await login(values)
        onSuccess()
      } catch {
        setError('Invalid credentials. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label>Username</Label>
        <Input
          name="username"
          value={formik.values.username}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          autoComplete="username"
          className="h-12 rounded-2xl border-white/10 bg-white/3 px-4 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/20"
          placeholder="admin"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Password</Label>
        <Input
          type="password"
          name="password"
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          autoComplete="current-password"
          className="h-12 rounded-2xl border-white/10 bg-white/3 px-4 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/20"
          placeholder="***********"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={formik.isSubmitting}
        className="group h-12 w-full rounded-2xl bg-white text-sm font-medium text-black transition-all hover:bg-zinc-200"
      >
        {formik.isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Authenticating...
          </>
        ) : (
          <>
            Sign In
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  )
}
