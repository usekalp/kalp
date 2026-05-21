import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe } from 'lucide-react'
import { SiAnthropic, SiCloudflare, SiOpenai, SiVercel } from 'react-icons/si'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/ui/dialog'
import { Button } from '#/ui/button'
import CopyButton from '#/features/shared/ui/copy-button'
import { PROVIDERS, PROVIDER_CLI } from '../constants'

interface AiProviderSelectorProps {
  currentProvider: string
  onChange: (id: string) => void
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  SiOpenai,
  SiAnthropic,
  Globe,
  SiCloudflare,
  SiVercel,
}

export function AiProviderSelector({
  currentProvider,
  onChange: _onChange,
}: AiProviderSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(currentProvider)

  const openChange = () => {
    setSelectedProvider(currentProvider)
    setDialogOpen(true)
  }

  const cliInfo = PROVIDER_CLI[selectedProvider] as
    | { flag: string; env: string }
    | undefined

  const aiChangeCmd = `kalp ai change --${cliInfo?.flag}`
  const deployCmd = 'kalp deploy'

  const providerDef = PROVIDERS.find((p) => p.id === currentProvider)
  const CurrentIcon = providerDef
    ? iconMap[providerDef.icon as keyof typeof iconMap]
    : null

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-white/2 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium text-white">
              Workspace AI Provider
            </h2>
            <p className="text-xs text-zinc-500">
              Default LLM provider for all agents in this workspace.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openChange}>
            Change
          </Button>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-white/2 px-3 py-2">
          {CurrentIcon && <CurrentIcon className="h-4 w-4" />}
          <code className="text-xs text-white">
            {providerDef?.label ?? currentProvider}
          </code>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl!">
          <DialogHeader>
            <DialogTitle>Change AI Provider</DialogTitle>
            <DialogDescription>
              Select your default LLM provider and follow the setup
              instructions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 grid-cols-[1fr_2fr]">
            <div className="space-y-2.5">
              {PROVIDERS.map((provider) => {
                const ProviderIcon =
                  iconMap[provider.icon as keyof typeof iconMap]
                const isActive = selectedProvider === provider.id
                return (
                  <div key={provider.id} className="w-full">
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setSelectedProvider(provider.id)}
                      className="w-full justify-start gap-2"
                    >
                      <ProviderIcon className="h-3.5 w-3.5 shrink-0" />
                      {provider.label}
                    </Button>
                  </div>
                )
              })}
            </div>

            <motion.div
              key={selectedProvider}
              initial={{ opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.985 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-2xl border border-white/05 bg-neutral-900 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]"
            >
              <div className="relative space-y-5 font-mono text-[12px] leading-relaxed">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Step 1 · Configure provider
                  </div>

                  <div className="group flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3 transition-colors hover:border-white/10">
                    <div className="overflow-x-auto whitespace-nowrap text-zinc-200">
                      <span className="text-zinc-500">~</span>{' '}
                      <span className="text-zinc-100">kalp ai change</span>{' '}
                      <span className="text-amber-400">--{cliInfo?.flag}</span>
                    </div>

                    <CopyButton text={aiChangeCmd} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Step 2 · Environment variable
                  </div>

                  <div className="group flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3 transition-colors hover:border-white/10">
                    <div className="overflow-x-auto whitespace-nowrap">
                      <span className="text-cyan-300">{cliInfo?.env}</span>
                      <span className="text-zinc-500">=...</span>
                    </div>

                    <CopyButton text={cliInfo?.env || ''} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Step 3 · Deploy
                  </div>

                  <div className="group flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3 transition-colors hover:border-white/10">
                    <div className="overflow-x-auto whitespace-nowrap text-emerald-400">
                      {deployCmd}
                    </div>

                    <CopyButton text={deployCmd} />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
