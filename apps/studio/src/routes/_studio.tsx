import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useParams,
  useRouter,
} from '@tanstack/react-router'
import {
  BrainCircuit,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  Radar,
  Settings2,
  UsersRound,
  Workflow,
  Zap,
} from 'lucide-react'
import { signOut, useAuth } from '#/hooks/useAuth'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { ReactNode } from 'react'

export const Route = createFileRoute('/_studio')({
  beforeLoad: async () => {
    const response = await fetch('/api/internal/session', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw redirect({ to: '/login' })
    }
  },
  component: StudioShell,
})

function StudioShell() {
  const { username } = useAuth()
  const location = useLocation()
  const isAgentContext = location.pathname.startsWith('/agent/')
  const params = useParams({ strict: false })
  const agentName =
    typeof params.agentName === 'string' && params.agentName.length > 0
      ? params.agentName
      : null

  const onLogout = async () => {
    await signOut()
    window.location.href = '/studio/login'
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/45 backdrop-blur-xl">
        <div className="flex h-14 w-full items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <img src="/studio/kalp-logo.png" alt="Kalp" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-[5px] border border-white/10 bg-white/[0.03] px-2 py-1">
              <div className="h-7 w-7 rounded-[4px] border border-white/10 bg-gradient-to-br from-zinc-300/20 via-zinc-500/20 to-zinc-300/20" />
              <span className="hidden text-[11px] uppercase tracking-[0.12em] text-zinc-400 md:inline">
                {username ?? 'admin'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="rounded-[5px] border border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-zinc-100"
            >
              <LogOut className="mr-1 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex w-full pt-14">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-3 lg:block">
          <nav className="space-y-1.5">
            {isAgentContext ? <AgentNav agentName={agentName} /> : <TeamNav />}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({
  to,
  params,
  label,
  icon,
}: {
  to: string
  params?: Record<string, string>
  label: string
  icon: ReactNode
}) {
  const router = useRouter()
  const location = useLocation()
  const targetPathname = router.buildLocation({ to, params }).pathname
  const isCurrent = location.pathname === targetPathname

  const baseClass =
    'group inline-flex w-full flex-row items-center justify-start gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all duration-150'

  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact: true }}
      className={cn(
        baseClass,
        isCurrent
          ? 'border-slate-200/20 bg-slate-200/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_24px_-16px_rgba(148,163,184,0.8)]'
          : 'border-transparent text-muted-foreground/55 hover:border-sky-200/20 hover:bg-gradient-to-r hover:from-white/8 hover:to-indigo-300/6 hover:text-zinc-200',
      )}
    >
      <span
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
          isCurrent ? 'border-white/10 bg-white/5' : 'border-transparent bg-transparent',
        )}
      >
        <span className="shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      </span>
      <span className="whitespace-nowrap leading-none tracking-wide">{label}</span>
    </Link>
  )
}

function TeamNav() {
  return (
    <>
      <NavItem to="/" label="Overview" icon={<LayoutGrid className="h-4 w-4" />} />
      <NavItem to="/settings" label="Settings" icon={<Settings2 className="h-4 w-4" />} />
      <NavItem to="/members" label="Members" icon={<UsersRound className="h-4 w-4" />} />
    </>
  )
}

function AgentNav({ agentName }: { agentName: string | null }) {
  if (!agentName) return <TeamNav />

  return (
    <>
      <NavItem to="/agent/$agentName" params={{ agentName }} label="Overview" icon={<Workflow className="h-4 w-4" />} />
      <NavItem
        to="/agent/$agentName/memory"
        params={{ agentName }}
        label="State"
        icon={<BrainCircuit className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/replay"
        params={{ agentName }}
        label="Executions"
        icon={<Radar className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/triggers"
        params={{ agentName }}
        label="Routes & Triggers"
        icon={<Zap className="h-4 w-4" />}
      />
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
        <div className="mb-1 flex items-center gap-2 text-zinc-400">
          <MessageSquareText className="h-3.5 w-3.5" />
          Chat
        </div>
        Use the overview page to send live messages and inspect runtime responses.
      </div>
    </>
  )
}
