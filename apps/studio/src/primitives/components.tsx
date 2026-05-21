import type { LucideIcon } from 'lucide-react'
import {
  ArrowRightLeft,
  CalendarClock,
  Globe,
  Mail,
  Moon,
  Search,
  UserCheck,
  Waves,
  Zap,
} from 'lucide-react'
import type { PrimitiveKind, AgentLiveStatus } from './registry'
import { PRIMITIVES, AGENT_STATUS } from './registry'

const iconCache = new Map<string, LucideIcon>()

function resolveIcon(name: string): LucideIcon {
  const cached = iconCache.get(name)
  if (cached) return cached

  const icons: Record<string, LucideIcon> = {
    Moon,
    ArrowRightLeft,
    Zap,
    UserCheck,
    CalendarClock,
    Waves,
    Mail,
    Globe,
    Search,
  }
  const icon = icons[name] ?? Zap
  iconCache.set(name, icon)
  return icon
}

export function PrimitiveBadge({
  kind,
  size = 'sm',
}: {
  kind: PrimitiveKind
  size?: 'sm' | 'md'
}) {
  const meta = PRIMITIVES[kind]
  if (!meta) return null

  const Icon = resolveIcon(meta.icon.name)
  const sizeClass =
    size === 'sm'
      ? 'gap-1 px-2 py-0.5 text-[11px]'
      : 'gap-1.5 px-2.5 py-1 text-xs'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/6 bg-white/2 text-zinc-400 ${sizeClass}`}
    >
      <Icon className={`${iconSize} shrink-0`} />
      <span className="leading-none">{meta.shortLabel ?? meta.label}</span>
    </span>
  )
}

export function PrimitiveCapabilities({
  primitives,
  size = 'sm',
}: {
  primitives: PrimitiveKind[]
  size?: 'sm' | 'md'
}) {
  if (primitives.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {primitives.map((kind) => (
        <PrimitiveBadge key={kind} kind={kind} size={size} />
      ))}
    </div>
  )
}

export function LiveStatus({
  status,
  label,
  since,
}: {
  status: AgentLiveStatus
  label?: string
  since?: string
}) {
  const meta = AGENT_STATUS[status]
  if (!meta) return null

  const Icon = resolveIcon(meta.icon.name)

  return (
    <div className="inline-flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
      <span className="relative flex h-2 w-2">
        {meta.pulse ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
        ) : null}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${meta.color}`}
        />
      </span>
      <span className={`text-xs font-medium ${meta.color}`}>
        {label ?? meta.label}
      </span>
      {since ? (
        <span className="text-[11px] text-zinc-500">{since}</span>
      ) : null}
    </div>
  )
}

export function useMockLiveStatus() {
  return {
    status: 'sleeping' as AgentLiveStatus,
    label: 'Sleeping for 5m',
    since: '2m ago',
  }
}
