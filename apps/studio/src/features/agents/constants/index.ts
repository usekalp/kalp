import { Globe, MessageSquareText, Sparkles, Zap } from 'lucide-react'

export const VIEW_LABELS: Record<string, string> = {
  overview: 'Overview',
  activity: 'Activity',
  chat: 'Chat',
  state: 'State',
  topology: 'Topology',
  replay: 'Replay',
}

export const ENTRYPOINT_ICONS: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  route: { icon: Globe, color: 'bg-blue-500/10 text-blue-400', label: 'Route' },
  hook: {
    icon: MessageSquareText,
    color: 'bg-purple-500/10 text-purple-400',
    label: 'Hook',
  },
  listener: {
    icon: Zap,
    color: 'bg-amber-500/10 text-amber-400',
    label: 'Listener',
  },
  contract: {
    icon: Sparkles,
    color: 'bg-indigo-500/10 text-indigo-400',
    label: 'Contract',
  },
}

export const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-400',
  PATCH: 'bg-amber-500/10 text-amber-400',
  DELETE: 'bg-red-500/10 text-red-400',
}
