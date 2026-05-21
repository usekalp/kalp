import { BookOpen } from 'lucide-react'
import { SiDiscord, SiX } from 'react-icons/si'
import { Outlet, useParams } from '@tanstack/react-router'
import { ToastProvider } from '#/features/shared/ui/toast-provider'
import { ToastContainer } from '#/features/shared/ui/toast'
import { CommandPalette } from '#/features/shared/ui/command-palette'
import StudioHeader from '#/features/shared/ui/studio-header'
import TeamSidebar from '#/features/shared/ui/team-sidebar'
import AgentSidebar from '#/features/shared/ui/agent-sidebar'
import { AnimatedPage } from '../animated-page'

export function StudioLayoutView() {
  const params = useParams({ strict: false })
  const agentName =
    typeof params.agentName === 'string' && params.agentName.length > 0
      ? params.agentName
      : null

  return (
    <AnimatedPage>
    <ToastProvider>
      <ToastContainer />
      <CommandPalette />
      <div className="min-h-screen bg-background text-foreground">
        <StudioHeader />
        <div className="flex w-full pt-16">
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-neutral-900 bg-background p-3 lg:flex lg:flex-col">
            <div className="flex-1">
              {agentName ? (
                <AgentSidebar agentName={agentName} />
              ) : (
                <TeamSidebar />
              )}
            </div>
            <div className="space-y-0.5 border-t border-neutral-900 pt-3">
              <span className="block px-3 pb-1 text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-600">
                Support
              </span>
              <a
                href="https://docs.usekalp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <BookOpen className="h-4 w-4" />
                Documentation
              </a>
              <a
                href="https://x.com/usekalp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <SiX className="h-3.5 w-3.5" />
                X (Twitter)
              </a>
              <a
                href="https://discord.gg/usekalp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <SiDiscord className="h-3.5 w-3.5" />
                Discord
              </a>
            </div>
          </aside>
          <main className="min-w-0 flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
    </AnimatedPage>
  )
}

