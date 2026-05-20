import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Check, Clipboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kalphq/ui'

export const Route = createFileRoute('/_studio/settings/ai')({
  component: AiSettingsPage,
})

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'cloudflare-ai', label: 'Cloudflare AI Gateway' },
  { id: 'vercel-ai', label: 'Vercel AI Gateway' },
] as const

const PROVIDER_CLI: Record<string, { flag: string; env: string }> = {
  openai: { flag: 'openai', env: 'OPENAI_API_KEY' },
  anthropic: { flag: 'anthropic', env: 'ANTHROPIC_API_KEY' },
  openrouter: { flag: 'openrouter', env: 'OPENROUTER_API_KEY' },
  'cloudflare-ai': { flag: 'cloudflare-ai', env: 'CLOUDFLARE_API_KEY' },
  'vercel-ai': { flag: 'vercel-ai', env: 'VERCEL_AI_API_KEY' },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          </motion.span>
        ) : (
          <motion.span
            key="clipboard"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            <Clipboard className="h-3.5 w-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

function AiSettingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('openai')

  const openChange = () => {
    setSelectedProvider('openai')
    setDialogOpen(true)
  }

  const cliInfo = PROVIDER_CLI[selectedProvider] as { flag: string; env: string } | undefined
  const selectedLabel = PROVIDERS.find((p) => p.id === selectedProvider)?.label ?? selectedProvider
  const aiChangeCmd = `kalp ai change --${cliInfo?.flag}`
  const deployCmd = 'kalp deploy'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-medium text-white">
              Workspace AI Provider
            </h2>
            <p className="text-xs text-zinc-500">
              Default LLM provider for all agents in this workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={openChange}
            className="cursor-pointer rounded-xl border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            Change
          </button>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-white/[0.02] px-3 py-2">
          <Bot className="h-4 w-4 text-zinc-500" />
          <code className="text-sm text-white">OpenAI</code>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-[#0D0D0D] text-zinc-300 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Change AI Provider</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Select your default LLM provider and follow the setup instructions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              {PROVIDERS.map((provider) => {
                const isActive = selectedProvider === provider.id
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                      isActive
                        ? 'bg-white/[0.05] text-white'
                        : 'text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300'
                    }`}
                  >
                    {provider.label}
                  </button>
                )
              })}
            </div>

            <motion.div
              key={selectedProvider}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="rounded-xl border border-zinc-800 bg-black/40 p-4 font-mono text-xs leading-relaxed"
            >
              <p className="mb-2 text-zinc-600"># Set provider to {selectedLabel}</p>
              <p className="flex items-center gap-2 text-zinc-300">
                <span>
                  kalp ai change{' '}
                  <span className="text-amber-400">--{cliInfo?.flag}</span>
                </span>
                <CopyButton text={aiChangeCmd} />
              </p>
              <p className="mt-3 text-zinc-600">
                # Add <span className="text-zinc-300">{cliInfo?.env}</span> to your .env
              </p>
              <p className="mt-3 text-zinc-600"># Deploy changes</p>
              <p className="flex items-center gap-2 text-emerald-400">
                <span>{deployCmd}</span>
                <CopyButton text={deployCmd} />
              </p>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
