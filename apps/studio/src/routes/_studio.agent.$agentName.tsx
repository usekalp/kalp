import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_studio/agent/$agentName')({
  component: AgentLayoutPage,
})

function AgentLayoutPage() {
  const { agentName } = Route.useParams()

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src="/studio/kalp-logo.png" alt="Kalp" className="h-9 w-auto object-contain opacity-90" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Agent</p>
            <h1 className="studio-metal-text text-xl font-semibold">{agentName}</h1>
          </div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center rounded-[5px] border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.12em] text-zinc-400 transition hover:border-white/25 hover:text-zinc-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </header>

      <Outlet />
    </main>
  )
}
