import { useCallback, useEffect, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from '@tanstack/react-router'
import {
  Activity,
  Bot,
  BrainCircuit,
  MessageSquareText,
  Radar,
  Route,
  Settings2,
  Workflow,
  Brain,
  User,
  Laptop,
  KeyIcon,
  HardDrive,
} from 'lucide-react'
import { useAgents } from '#/features/agents/hooks/use-agents'
import { HiMiniUserGroup } from 'react-icons/hi2'

const NAV_ITEMS = [
  { to: '/', label: 'Agents', icon: Bot },
  { to: '/members', label: 'Team', icon: HiMiniUserGroup },
  { to: '/settings', label: 'Settings', icon: Settings2 },
  { to: '/settings/secrets', label: 'Secrets Settings', icon: KeyIcon },
  { to: '/settings/ai', label: 'AI Settings', icon: Brain },
  { to: '/settings/mcp', label: 'MCP Settings', icon: HardDrive },
]

const AGENT_PAGES = [
  { suffix: '', label: 'Overview', icon: Workflow },
  { suffix: '/activity', label: 'Activity', icon: Activity },
  { suffix: '/chat', label: 'Chat', icon: MessageSquareText },
  { suffix: '/replay', label: 'Replay', icon: Radar },
  { suffix: '/state', label: 'State', icon: BrainCircuit },
  { suffix: '/topology', label: 'Topology', icon: Route },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const agentsQuery = useAgents()
  const agents = agentsQuery.data?.agents ?? []
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    const handler = () => setOpen((prev) => !prev)
    window.addEventListener('toggle-command-palette', handler)
    return () => window.removeEventListener('toggle-command-palette', handler)
  }, [])

  const handleSelect = useCallback(
    (value: string) => {
      navigate({ to: value })
      setOpen(false)
    },
    [navigate],
  )

  const handleSelectAgent = useCallback(
    (agentName: string, suffix: string) => {
      navigate({ to: `/agent/${agentName}${suffix}` })
      setOpen(false)
    },
    [navigate],
  )

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
    >
      <div
        className="fixed inset-0 bg-black/60"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-[#0D0D0D] shadow-2xl">
        <Command.Input
          ref={inputRef}
          placeholder="Search pages and agents..."
          className="w-full border-b border-zinc-800 bg-transparent px-4 py-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-zinc-500">
            No results found.
          </Command.Empty>
          <Command.Group heading="Pages" className="text-[11px] mb-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Command.Item
                  key={item.to}
                  value={item.to}
                  onSelect={() => handleSelect(item.to)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-zinc-400 transition-colors data-[selected=true]:bg-white/6 data-[selected=true]:text-zinc-200"
                >
                  <span className="grid h-4 w-4 shrink-0 place-items-center">
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </Command.Item>
              )
            })}
          </Command.Group>
          <Command.Separator className="mx-2 my-2 h-px bg-neutral-900" />
          <Command.Group heading="Account" className="text-[11px] mb-2">
            <Command.Item
              value="/account"
              onSelect={() => handleSelect('/account')}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-zinc-400 transition-colors data-[selected=true]:bg-white/6 data-[selected=true]:text-zinc-200"
            >
              <span className="grid h-4 w-4 shrink-0 place-items-center">
                <User className="h-4 w-4" />
              </span>
              Account Preferences
            </Command.Item>
          </Command.Group>
          {agents.length > 0 && (
            <>
              <Command.Separator className="mx-2 my-2 h-px bg-neutral-900" />
              <Command.Group heading="Agents" className="text-[11px] mb-2">
                {agents.map((agent) => {
                  const label = agent.label ?? agent.name
                  return (
                    <Command.Item
                      key={agent.name}
                      value={`agent:${label}`}
                      onSelect={() => handleSelectAgent(agent.name, '')}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-zinc-400 transition-colors data-[selected=true]:bg-white/6 data-[selected=true]:text-zinc-200"
                    >
                      <span className="grid h-4 w-4 shrink-0 place-items-center">
                        <Bot className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">{label}</span>
                      <span className="shrink-0 text-[11px] text-zinc-600">
                        {agent.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
              <Command.Separator className="mx-2 my-2 h-px bg-neutral-900" />
              <Command.Group heading="Agent Pages" className="text-[11px] mb-2">
                {agents.map((agent) =>
                  AGENT_PAGES.map((page) => (
                    <Command.Item
                      key={`${agent.name}${page.suffix}`}
                      value={`agent:${agent.label ?? agent.name} ${page.label}`}
                      onSelect={() =>
                        handleSelectAgent(agent.name, page.suffix)
                      }
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-zinc-400 transition-colors data-[selected=true]:bg-white/6 data-[selected=true]:text-zinc-200"
                    >
                      <span className="grid h-4 w-4 shrink-0 place-items-center">
                        <page.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">
                        {agent.label ?? agent.name}
                        <span className="ml-1 text-zinc-600">
                          — {page.label}
                        </span>
                      </span>
                    </Command.Item>
                  )),
                )}
              </Command.Group>
            </>
          )}
        </Command.List>
        <div className="flex items-center gap-3 border-t border-zinc-800 px-4 py-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
            <Laptop className="h-3 w-3" />
            Local Engine
          </span>
        </div>
      </div>
    </Command.Dialog>
  )
}
