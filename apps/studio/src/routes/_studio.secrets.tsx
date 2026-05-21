import { createFileRoute } from '@tanstack/react-router'
import { Copy, KeyRound, Plus } from 'lucide-react'
import { Button } from '@/ui/button'

export const Route = createFileRoute('/_studio/secrets')({
  component: SecretsPage,
})

const MOCK_SECRETS = [
  { key: 'ANTHROPIC_API_KEY', updated: '2h ago via CLI' },
  { key: 'OPENAI_API_KEY', updated: '1d ago via CLI' },
  { key: 'STRIPE_SECRET_KEY', updated: '3d ago via CLI' },
]

function SecretsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-medium tracking-tight text-white">
            Secrets
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Centralized API Keys for your agents
          </p>
        </div>
        <Button type="button" variant="outline" size="lg">
          <Plus className="h-3 w-3" />
          Add Secret
        </Button>
      </div>

      {MOCK_SECRETS.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
          <KeyRound className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">
            No secrets configured. Add your first API key.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {MOCK_SECRETS.map((secret) => (
            <div
              key={secret.key}
              className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/2 px-4 py-3 transition-colors hover:border-zinc-700"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-zinc-500" />
              <code className="min-w-0 flex-1 text-sm font-medium text-white">
                {secret.key}
              </code>
              <code className="shrink-0 text-xs tracking-wider text-zinc-600">
                {'\u2022'.repeat(16)}
              </code>
              <span className="shrink-0 text-[11px] text-zinc-600">
                {secret.updated}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Copy key name"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
