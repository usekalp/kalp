import { createFileRoute } from '@tanstack/react-router'
import { Database, HardDrive } from 'lucide-react'

export const Route = createFileRoute('/_studio/storage')({
  component: StoragePage,
})

const STORES = [
  {
    name: 'KV Store',
    description: 'Key-Value storage for your agents',
    icon: Database,
    status: 'Connected',
  },
  {
    name: 'D1 Database',
    description: 'SQLite database for structured data',
    icon: HardDrive,
    status: 'Connected',
  },
]

function StoragePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-medium tracking-tight text-white">
          Storage
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Shared KV Stores & D1 Databases
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {STORES.map((store) => {
          const Icon = store.icon
          return (
            <div
              key={store.name}
              className="rounded-xl border border-zinc-800 bg-white/[0.02] p-4 transition-colors hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                    <Icon className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {store.name}
                    </p>
                    <p className="text-xs text-zinc-500">{store.description}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {store.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-zinc-600">
        Configure stores in your{' '}
        <code className="font-mono text-zinc-500">kalp.config.ts</code>
      </p>
    </div>
  )
}
