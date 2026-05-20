import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
  useParams,
  useRouter,
} from '@tanstack/react-router'
import {
  Activity,
  Bot,
  BrainCircuit,
  Laptop,
  LogOut,
  MessageSquareText,
  Radar,
  Route as RouteIcon,
  Settings2,
  User,
  UsersRound,
  Workflow,
  ArrowLeft,
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kalphq/ui'
import { ToastProvider } from '#/components/toast'
import { signOut, useAuth } from '#/hooks/useAuth'
import { cn } from '#/lib/utils'

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
  const navigate = useNavigate()
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
    <ToastProvider>
      <div className="min-h-screen bg-[#0A0A0A] text-foreground">
        <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-zinc-800 bg-black/40 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <img
              src="/studio/kalp-logo.png"
              alt="Kalp"
              className="h-7 w-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-2">
              <Laptop className="h-3.5 w-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-500">Local Engine</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl border border-zinc-800 bg-white/[0.03] text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                >
                  {username?.charAt(0).toUpperCase() ?? 'A'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-white">
                    {username ?? 'admin'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {username ? `${username}@workspace.com` : 'admin@local'}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: '/account' })}>
                  <User className="mr-2 h-3.5 w-3.5" />
                  Account Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex w-full pt-12">
          <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-64 shrink-0 border-r border-zinc-800 bg-[#0A0A0A] p-3 lg:block">
            {isAgentContext && agentName ? (
              <AgentSidebar agentName={agentName} />
            ) : (
              <TeamSidebar />
            )}
          </aside>

          <main className="min-w-0 flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

function NavItem({
  to,
  params,
  label,
  icon,
  exact = true,
}: {
  to: string
  params?: Record<string, string>
  label: string
  icon: ReactNode
  exact?: boolean
}) {
  const router = useRouter()
  const location = useLocation()
  const targetPathname = router.buildLocation({ to, params }).pathname
  const isCurrent = exact
    ? location.pathname === targetPathname
    : location.pathname.startsWith(targetPathname)

  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 ease-out',
        isCurrent
          ? 'bg-white/[0.05] text-white'
          : 'text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300',
      )}
    >
      <span
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center',
          isCurrent ? 'text-white' : 'text-zinc-500',
        )}
      >
        {icon}
      </span>
      <span className="leading-none tracking-wide">{label}</span>
    </Link>
  )
}

function TeamSidebar() {
  return (
    <nav className="flex h-full flex-col gap-1">
      <NavItem to="/" label="Agents" icon={<Bot className="h-4 w-4" />} />
      <NavItem
        to="/members"
        label="Team"
        icon={<UsersRound className="h-4 w-4" />}
      />
      <NavItem
        to="/settings"
        label="Settings"
        icon={<Settings2 className="h-4 w-4" />}
        exact={false}
      />
    </nav>
  )
}

function AgentSidebar({ agentName }: { agentName: string }) {
  return (
    <nav className="flex h-full flex-col gap-1">
      <Link
        to="/"
        className="mb-2 flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-zinc-500 transition-colors duration-150 ease-out hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workspace
      </Link>

      <div className="mb-2 border-b border-zinc-800 pb-2">
        <p className="truncate px-3 text-sm font-medium text-white">
          {agentName}
        </p>
      </div>

      <NavItem
        to="/agent/$agentName"
        params={{ agentName }}
        label="Overview"
        icon={<Workflow className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/activity"
        params={{ agentName }}
        label="Activity"
        icon={<Activity className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/chat"
        params={{ agentName }}
        label="Chat"
        icon={<MessageSquareText className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/replay"
        params={{ agentName }}
        label="Replay"
        icon={<Radar className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/state"
        params={{ agentName }}
        label="State"
        icon={<BrainCircuit className="h-4 w-4" />}
        exact={false}
      />
      <NavItem
        to="/agent/$agentName/topology"
        params={{ agentName }}
        label="Topology"
        icon={<RouteIcon className="h-4 w-4" />}
        exact={false}
      />
    </nav>
  )
}
