import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { useToast } from '#/components/toast'
import { Separator } from '#/ui'

export const Route = createFileRoute('/_studio/account')({
  component: AccountPage,
})

function AccountPage() {
  const { toast } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const canSave = newPassword.length >= 6 && newPassword === confirmPassword

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!canSave) return

    setLoading(true)

    await new Promise((r) => setTimeout(r, 1500))

    if (Math.random() > 0.2) {
      toast('success', 'Password updated successfully.')
    } else {
      toast('error', 'Failed to update password. Try again.')
    }

    setLoading(false)
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div>
      <h1 className="mb-5 text-base font-medium tracking-tight text-white">
        Account
      </h1>

      <div className="mb-6 flex gap-1 border-b border-zinc-800">
        <span className="border-b-2 border-white/60 px-3 py-2 text-xs font-medium text-white">
          Security
        </span>
      </div>

      <div className="space-y-5">
        <form
          className="space-y-4 w-xl rounded-xl border border-zinc-900 bg-white/2 p-5"
          onSubmit={handleSave}
        >
          <h2 className="text-xs font-medium text-white">Update Password</h2>
          <Separator />
          <div className="space-y-3">
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
              />
            </div>

            <div>
              <Label>Repeat Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>

          <div className="w-full">
            <Button
              type="submit"
              disabled={!canSave || loading}
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
      </div>
    </div>
  )
}
