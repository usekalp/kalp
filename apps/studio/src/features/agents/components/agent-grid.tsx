import { AnimatePresence, motion } from 'framer-motion'
import { Bot } from 'lucide-react'
import { Skeleton } from '#/ui/skeleton'
import { AgentCard, type AgentCardAgent } from './agent-card'

interface AgentGridProps {
  agents: AgentCardAgent[]
  isLoading: boolean
}

export function AgentGrid({ agents, isLoading }: AgentGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-800 bg-white/2 p-4"
          >
            <div className="mb-3 h-5 w-32">
              <Skeleton />
            </div>
            <div className="mb-2 h-3 w-full">
              <Skeleton />
            </div>
            <div className="mb-4 h-3 w-3/4">
              <Skeleton />
            </div>
            <div className="h-3 w-20">
              <Skeleton />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 justify-center rounded-xl border border-dashed border-zinc-800 py-20">
        <Bot className="w-10 h-10 text-zinc-500" />
        <p className="text-sm text-zinc-500">No agents found.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {agents.map((agent) => (
          <motion.div
            key={agent.name}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <AgentCard agent={agent} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
