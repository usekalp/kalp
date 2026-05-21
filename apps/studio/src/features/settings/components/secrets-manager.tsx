import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EllipsisVertical, KeyRound, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/ui'
import { Input } from '#/ui/input'
import { Label } from '#/ui/label'
import { useFormik } from 'formik'
import { z } from 'zod'
import { toFormikValidate } from 'zod-formik-adapter'
import { getSecrets, saveSecret, deleteSecret } from '../services'

interface Secret {
  key: string
  value: string
  updatedAt: string
}

const secretSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
})

export function SecretsManager() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)

  const { data: secrets = [] } = useQuery({
    queryKey: ['secrets'],
    queryFn: getSecrets as () => Promise<Secret[]>,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await saveSecret(key, value)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] })
      setDialogOpen(false)
      formik.resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      await deleteSecret(key)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets'] })
      setDeleteKey(null)
    },
  })

  const formik = useFormik({
    initialValues: { key: '', value: '' },
    validate: toFormikValidate(secretSchema),
    onSubmit: (values) => {
      saveMutation.mutate({ key: values.key.trim(), value: values.value.trim() })
    },
  })

  const openAdd = () => {
    setEditingKey(null)
    formik.resetForm()
    setDialogOpen(true)
  }

  const openEdit = (secret: Secret) => {
    setEditingKey(secret.key)
    formik.setValues({ key: secret.key, value: '' })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-500">
          Environment variables injected into your agents at runtime.
        </p>
        <Button variant="outline" size="lg" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add Secret
        </Button>
      </div>

      {secrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
          <KeyRound className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">No secrets configured.</p>
        </div>
      ) : (
        <AnimatePresence>
          {secrets.map((secret: Secret) => (
            <motion.div
              key={secret.key}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/2 px-4 py-3"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-zinc-500" />
              <code className="min-w-0 flex-1 text-sm text-white">{secret.key}</code>
              <span className="shrink-0 text-[11px] text-zinc-600">{secret.updatedAt}</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(secret)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteKey(secret.key)}>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit Secret' : 'Add Secret'}</DialogTitle>
            <DialogDescription>
              {editingKey
                ? 'Update the key or value for this secret.'
                : 'Add a new environment variable for your agents.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={formik.handleSubmit}>
            <div className="space-y-3">
              <div>
                <Label>Key</Label>
                <Input
                  name="key"
                  value={formik.values.key}
                  onChange={formik.handleChange}
                  placeholder="e.g. OPENAI_API_KEY"
                />
                {formik.errors.key && (
                  <p className="mt-1 text-xs text-red-400">{formik.errors.key}</p>
                )}
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  name="value"
                  value={formik.values.value}
                  onChange={formik.handleChange}
                  placeholder="e.g. sk-..."
                />
                {formik.errors.value && (
                  <p className="mt-1 text-xs text-red-400">{formik.errors.value}</p>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editingKey ? 'Save' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteKey !== null}
        onOpenChange={(open) => { if (!open) setDeleteKey(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <code className="text-zinc-300">{deleteKey}</code>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="default"
              onClick={() => deleteKey && deleteMutation.mutate(deleteKey)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
