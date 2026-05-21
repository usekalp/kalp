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
} from '@/ui'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

export const Route = createFileRoute('/_studio/settings/secrets')({
  component: SecretsPage,
})

interface Secret {
  key: string
  value: string
  updated: string
}

const INITIAL_SECRETS: Secret[] = [
  {
    key: 'ANTHROPIC_API_KEY',
    value: 'sk-ant-xxxxxxxxxxxxxxxx',
    updated: '2h ago via CLI',
  },
  {
    key: 'OPENAI_API_KEY',
    value: 'sk-proj-xxxxxxxxxxxxxxxx',
    updated: '1d ago via CLI',
  },
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
            ? {
                ...s,
                key: trimmedKey,
                value: trimmedValue,
                updated: 'just now via Studio',
              }
            : s,
        ),
      )
    } else {
      setSecrets((prev) => [
        ...prev,
        {
          key: trimmedKey,
          value: trimmedValue,
          updated: 'just now via Studio',
        },
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
          {secrets.map((secret, idx) => (
            <motion.div
              key={secret.key}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                height: 0,
                marginBottom: 0,
                overflow: 'hidden',
              }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/2 px-4 py-3"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-zinc-500" />
              <code className="min-w-0 flex-1 text-sm text-white">
                {secret.key}
              </code>
              <span className="shrink-0 text-[11px] text-zinc-600">
                {secret.updated}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(idx)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteIndex(idx)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? 'Edit Secret' : 'Add Secret'}
            </DialogTitle>
            <DialogDescription>
              {editingIndex !== null
                ? 'Update the key or value for this secret.'
                : 'Add a new environment variable for your agents.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Key</Label>
              <Input
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="e.g. OPENAI_API_KEY"
              />
            </div>
            <div>
              <Label>Value</Label>
              <Input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="e.g. sk-..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formKey.trim() || !formValue.trim()}
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
            <AlertDialogCancel variant="outline" size="default">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="default"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
