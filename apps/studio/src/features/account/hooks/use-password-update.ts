import { useState } from 'react'
import { useToast } from '#/features/shared/hooks/use-toast'
import { updatePassword } from '../services'

export function usePasswordUpdate() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleSave = async (password: string) => {
    setLoading(true)
    try {
      await updatePassword('_studio_password', password)
      toast('success', 'Password updated successfully.')
    } catch {
      toast('error', 'Failed to update password. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return { handleSave, loading }
}
