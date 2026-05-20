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
  Pause,
  Activity,
  TriangleAlert,
  UserRound,
  Radio,
  Play,
} from 'lucide-react'

export type PrimitiveKind =
  | 'sleep'
  | 'call'
  | 'dispatch'
  | 'ask'
  | 'schedule'
  | 'ai.stream'
  | 'email.send'
  | 'browser.open'
  | 'memory.search'

export type PrimitiveCategory =
  | 'flow'
  | 'communication'
  | 'human'
  | 'browser'
  | 'memory'
  | 'time'

export interface PrimitiveDescriptor {
  id: PrimitiveKind
  label: string
  shortLabel?: string
  description: string
  icon: LucideIcon
  category: PrimitiveCategory

  group?: string
  sideEffect?: boolean
  risk?: 'low' | 'medium' | 'high'
  deterministic?: boolean

  blocking?: boolean
  streaming?: boolean
  replayable?: boolean
  transport?: 'internal' | 'http' | 'ws'
  threadCapable?: boolean

  source?: 'core' | 'plugin' | 'user'

  color?: string
}

export const PRIMITIVES: Record<PrimitiveKind, PrimitiveDescriptor> = {
  sleep: {
    id: 'sleep',
    label: 'Sleep',
    description: 'Pauses execution for a duration.',
    icon: Moon,
    category: 'time',
    group: 'runtime',
    risk: 'low',
    deterministic: true,
    blocking: true,
    replayable: true,
    transport: 'internal',
    source: 'core',
  },

  call: {
    id: 'call',
    label: 'Request-Response',
    description: 'Calls another listener and waits for output.',
    icon: ArrowRightLeft,
    category: 'communication',
    group: 'communication',
    risk: 'medium',
    deterministic: false,
    blocking: true,
    replayable: true,
    transport: 'internal',
    threadCapable: true,
    source: 'core',
  },

  dispatch: {
    id: 'dispatch',
    label: 'Dispatch',
    description: 'Emits a background event.',
    icon: Zap,
    category: 'communication',
    group: 'communication',
    risk: 'medium',
    deterministic: false,
    sideEffect: true,
    replayable: true,
    transport: 'internal',
    threadCapable: true,
    source: 'core',
  },

  ask: {
    id: 'ask',
    label: 'Human Approval',
    description: 'Pauses for human input or approval.',
    icon: UserCheck,
    category: 'human',
    group: 'human',
    risk: 'high',
    deterministic: false,
    blocking: true,
    replayable: true,
    transport: 'ws',
    threadCapable: true,
    source: 'core',
  },

  schedule: {
    id: 'schedule',
    label: 'Schedule',
    description: 'Schedules execution for a future time.',
    icon: CalendarClock,
    category: 'time',
    group: 'runtime',
    risk: 'medium',
    deterministic: true,
    replayable: true,
    threadCapable: true,
    transport: 'internal',
    source: 'core',
  },

  'ai.stream': {
    id: 'ai.stream',
    label: 'AI Stream',
    description: 'Streams tokens to the client.',
    icon: Waves,
    category: 'communication',
    group: 'ai',
    risk: 'low',
    deterministic: false,
    streaming: true,
    threadCapable: true,
    transport: 'ws',
    source: 'core',
  },

  'email.send': {
    id: 'email.send',
    label: 'Send Email',
    description: 'Sends an email notification.',
    icon: Mail,
    category: 'communication',
    group: 'communication',
    risk: 'high',
    deterministic: true,
    sideEffect: true,
    replayable: true,
    transport: 'http',
    source: 'core',
  },

  'browser.open': {
    id: 'browser.open',
    label: 'Open Browser',
    description: 'Opens a browser session.',
    icon: Globe,
    category: 'browser',
    group: 'browser',
    risk: 'high',
    deterministic: false,
    sideEffect: true,
    blocking: true,
    threadCapable: true,
    transport: 'ws',
    source: 'core',
  },

  'memory.search': {
    id: 'memory.search',
    label: 'Memory Search',
    description: 'Queries agent memory store.',
    icon: Search,
    category: 'memory',
    group: 'memory',
    risk: 'low',
    deterministic: false,
    transport: 'internal',
    source: 'core',
  },
}

export type AgentLiveStatus =
  | 'starting'
  | 'idle'
  | 'running'
  | 'sleeping'
  | 'waiting-human'
  | 'streaming'
  | 'error'
  | 'stopped'

export interface AgentStatusMeta {
  label: string
  icon: LucideIcon
  color: string
  pulse?: boolean
}

export const AGENT_STATUS: Record<AgentLiveStatus, AgentStatusMeta> = {
  starting:       { label: 'Starting',      icon: Play,          color: 'text-zinc-400', pulse: true },
  idle:           { label: 'Idle',          icon: Pause,         color: 'text-zinc-400' },
  running:        { label: 'Executing',     icon: Activity,       color: 'text-emerald-400', pulse: true },
  sleeping:       { label: 'Sleeping',      icon: Moon,          color: 'text-sky-400', pulse: true },
  'waiting-human':{ label: 'Awaiting Input',icon: UserRound,     color: 'text-amber-400', pulse: true },
  streaming:      { label: 'Streaming',     icon: Radio,         color: 'text-violet-400', pulse: true },
  error:          { label: 'Error',         icon: TriangleAlert, color: 'text-red-400' },
  stopped:        { label: 'Stopped',       icon: Pause,         color: 'text-zinc-500' },
}
