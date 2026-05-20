import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Lock } from 'lucide-react'
import { useToast } from '#/components/toast'

export const Route = createFileRoute('/_studio/account')({
  component: AccountPage,
})

function AccountPage() {
  const { toast } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const canSave = newPassword.length >= 6 && newPassword === confirmPassword

  const handleSave = async () => {
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
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-base font-medium tracking-tight text-white">
        Account Preferences
      </h1>

      <div className="space-y-4 rounded-xl border border-zinc-800 bg-white/[0.02] p-5">
        <h2 className="text-xs font-medium text-white">Update Password</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">New Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full rounded-xl border border-zinc-800 bg-white/[0.02] py-2 pl-9 pr-3 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-zinc-700"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">Repeat Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full rounded-xl border border-zinc-800 bg-white/[0.02] py-2 pl-9 pr-3 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-zinc-700"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-white/[0.02] px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </>
          ) : (
            'Update Password'
          )}
        </button>
      </div>
    </div>
  )
}
