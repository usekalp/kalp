import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { EllipsisVertical, KeyRound, Plus } from 'lucide-react'
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
} from '@kalphq/ui'

export const Route = createFileRoute('/_studio/settings/secrets')({
  component: SecretsPage,
})

interface Secret {
  key: string
  value: string
  updated: string
}

const INITIAL_SECRETS: Secret[] = [
  { key: 'ANTHROPIC_API_KEY', value: 'sk-ant-xxxxxxxxxxxxxxxx', updated: '2h ago via CLI' },
  { key: 'OPENAI_API_KEY', value: 'sk-proj-xxxxxxxxxxxxxxxx', updated: '1d ago via CLI' },
]

function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>(INITIAL_SECRETS)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [formKey, setFormKey] = useState('')
  const [formValue, setFormValue] = useState('')

  const openAdd = () => {
    setEditingIndex(null)
    setFormKey('')
    setFormValue('')
    setDialogOpen(true)
  }

  const openEdit = (idx: number) => {
    setEditingIndex(idx)
    setFormKey(secrets[idx].key)
    setFormValue('')
    setDialogOpen(true)
  }

  const handleSave = () => {
    const trimmedKey = formKey.trim()
    const trimmedValue = formValue.trim()
    if (!trimmedKey || !trimmedValue) return

    if (editingIndex !== null) {
      setSecrets((prev) =>
        prev.map((s, i) =>
          i === editingIndex
            ? { ...s, key: trimmedKey, value: trimmedValue, updated: 'just now via Studio' }
            : s,
        ),
      )
    } else {
      setSecrets((prev) => [
        ...prev,
        { key: trimmedKey, value: trimmedValue, updated: 'just now via Studio' },
      ])
    }
    setDialogOpen(false)
  }

  const handleDelete = () => {
    if (deleteIndex !== null) {
      setSecrets((prev) => prev.filter((_, i) => i !== deleteIndex))
      setDeleteIndex(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-500">
          Environment variables injected into your agents at runtime.
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-white/[0.04] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Secret
        </button>
      </div>

      {secrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
          <KeyRound className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">No secrets configured.</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {secrets.map((secret, idx) => (
            <motion.div
              key={secret.key}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/[0.02] px-4 py-3"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-zinc-500" />
              <code className="min-w-0 flex-1 text-sm text-white">{secret.key}</code>
              <span className="shrink-0 text-[11px] text-zinc-600">{secret.updated}</span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => openEdit(idx)} className="text-xs">
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteIndex(idx)} className="text-xs text-red-400">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-[#0D0D0D] text-zinc-300 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingIndex !== null ? 'Edit Secret' : 'Add Secret'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {editingIndex !== null
                ? 'Update the key or value for this secret.'
                : 'Add a new environment variable for your agents.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Key</label>
              <input
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="e.g. OPENAI_API_KEY"
                className="w-full rounded-xl border border-zinc-800 bg-white/[0.02] px-3 py-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-zinc-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Value</label>
              <input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="e.g. sk-..."
                className="w-full rounded-xl border border-zinc-800 bg-white/[0.02] px-3 py-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-zinc-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-zinc-800 text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formKey.trim() || !formValue.trim()}
              className="bg-white text-black hover:bg-zinc-200"
            >
              {editingIndex !== null ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <code className="text-zinc-300">
                {deleteIndex !== null ? secrets[deleteIndex]?.key : ''}
              </code>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <button
                type="button"
                className="rounded-xl border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Cancel
              </button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                Delete
              </button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
