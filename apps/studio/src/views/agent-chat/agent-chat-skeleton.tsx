export default function AgentChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-15rem)] flex-col animate-pulse">
      <div className="flex gap-2">
        <div className="h-6 w-32 rounded-xl bg-white/5" />
        <div className="h-6 w-28 rounded-xl bg-white/5" />
        <div className="h-6 w-24 rounded-xl bg-white/5" />
      </div>
      <div className="flex-1 mt-4">
        <div className="h-full rounded-xl border border-zinc-800/50 bg-white/5" />
      </div>
      <div className="h-28 mt-4 rounded-xl border border-zinc-800/50 bg-white/5" />
    </div>
  )
}
