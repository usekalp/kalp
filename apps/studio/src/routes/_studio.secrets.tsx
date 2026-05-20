import { createFileRoute } from '@tanstack/react-router'
import { Copy, KeyRound, Plus } from 'lucide-react'

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
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Secret
        </button>
      </div>

      {MOCK_SECRETS.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.06] py-16">
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
              className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/[0.1]"
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
              <button
                type="button"
                className="shrink-0 rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                title="Copy key name"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
