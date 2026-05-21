export default function AgentReplaySkeleton() {
  return (
    <div className="border border-zinc-800/50 rounded-xl p-5 animate-pulse">
      <div className="h-4 w-40 mb-4 rounded-xl bg-white/5" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl border border-zinc-800/50 bg-white/5 mb-3 last:mb-0 p-4">
          <div className="h-4 w-32 rounded-xl bg-white/5" />
          <div className="h-3 w-56 mt-2 rounded-xl bg-white/5" />
          <div className="h-3 w-24 mt-2 rounded-xl bg-white/5" />
        </div>
      ))}
    </div>
  )
}
