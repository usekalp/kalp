import { useFormik } from 'formik'
import { z } from 'zod'
import { toFormikValidate } from 'zod-formik-adapter'
import { Loader2 } from 'lucide-react'
import { Button } from '#/ui/button'
import { Input } from '#/ui/input'
import { Label } from '#/ui/label'
import { Separator } from '#/ui'
import { usePasswordUpdate } from '../hooks/use-password-update'

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Min. 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export function PasswordForm() {
  const { handleSave, loading } = usePasswordUpdate()

  const formik = useFormik({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: toFormikValidate(passwordSchema),
    onSubmit: async (values) => {
      await handleSave(values.newPassword)
      formik.resetForm()
    },
  })

  return (
    <form className="space-y-4 w-xl rounded-xl border border-zinc-900 bg-white/2 p-5" onSubmit={formik.handleSubmit}>
      <h2 className="text-xs font-medium text-white">Update Password</h2>
      <Separator />
      <div className="space-y-3">
        <div>
          <Label>New Password</Label>
          <Input
            type="password"
            name="newPassword"
            value={formik.values.newPassword}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="Min. 6 characters"
          />
        </div>

        <div>
          <Label>Repeat Password</Label>
          <Input
            type="password"
            name="confirmPassword"
            value={formik.values.confirmPassword}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="Repeat new password"
          />
        </div>
      </div>

      <div className="w-full">
        <Button
          type="submit"
          disabled={loading || !formik.isValid || !formik.dirty}
          variant="outline"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </>
          ) : (
            'Update Password'
          )}
        </Button>
      </div>
    </form>
  )
}
