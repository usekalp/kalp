import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
import { LogOut, Settings, Shield, Users, Workflow } from 'lucide-react'
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

  const onLogout = async () => {
    await signOut()
    window.location.href = '/studio/login'
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/studio/kalp-logo.png"
              alt="Kalp"
              className="h-8 w-8 rounded-md border border-white/10 bg-black/40 p-1"
            />
            <span className="text-sm font-medium tracking-wide text-white/90">Kalp Studio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:inline">{username ?? 'admin'}</span>
            <div className="h-8 w-8 rounded-full border border-white/15 bg-gradient-to-br from-indigo-500/70 to-cyan-400/70" />
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
              <LogOut className="mr-1 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] pt-14">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-white/10 bg-white/[0.03] p-4 lg:block">
          <div className="mb-4 px-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {isAgentContext ? 'Agent Context' : 'Team Context'}
          </div>
          <nav className="space-y-1.5">
            {isAgentContext ? <AgentNav /> : <TeamNav />}
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
  href,
  label,
  icon,
  isActive,
}: {
  href: string
  label: string
  icon: ReactNode
  isActive?: boolean
}) {
  return (
    <a
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
        isActive
          ? 'border-white/20 bg-white/10 text-white'
          : 'border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}

function TeamNav() {
  return (
    <>
      <NavItem href="/studio/" label="Overview" icon={<Workflow className="h-4 w-4" />} isActive />
      <NavItem href="/studio/" label="Settings" icon={<Settings className="h-4 w-4" />} />
      <NavItem href="/studio/" label="Members" icon={<Users className="h-4 w-4" />} />
    </>
  )
}

function AgentNav() {
  return (
    <>
      <NavItem href="/studio/" label="Overview" icon={<Shield className="h-4 w-4" />} isActive />
      <NavItem href="/studio/" label="Memory" icon={<Workflow className="h-4 w-4" />} />
      <NavItem href="/studio/" label="Replay" icon={<Users className="h-4 w-4" />} />
      <NavItem href="/studio/" label="Triggers" icon={<Settings className="h-4 w-4" />} />
    </>
  )
}
