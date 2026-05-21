export default function AgentTopologySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-pulse">
      <div className="border border-zinc-800/50 rounded-xl p-4">
        <div className="h-4 w-24 mb-3 rounded-xl bg-white/5" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/5 mb-2 last:mb-0" />
        ))}
      </div>
      <div className="border border-zinc-800/50 rounded-xl p-4">
        <div className="h-4 w-28 mb-3 rounded-xl bg-white/5" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/5 mb-2 last:mb-0" />
        ))}
      </div>
    </div>
  )
}
