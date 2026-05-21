export default function AgentOverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 border border-zinc-800/50 rounded-xl p-5">
            <div className="h-8 w-8 rounded-xl bg-white/5" />
            <div className="h-8 w-24 mt-3 rounded-xl bg-white/5" />
            <div className="h-3 w-20 mt-2 rounded-xl bg-white/5" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl border border-zinc-800/50 bg-white/5" />
        ))}
      </div>
    </div>
  )
}
