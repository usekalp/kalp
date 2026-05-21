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
import type { PrimitiveKind } from '#/primitives/registry'
import { PRIMITIVES } from '#/primitives/registry'

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
