export default function AgentStateSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] animate-pulse">
      <div className="border border-zinc-800/50 rounded-xl p-5">
        <div className="h-4 w-44 rounded-xl bg-white/5" />
        <div className="h-64 w-full mt-3 rounded-xl bg-white/5" />
      </div>
      <div className="border border-zinc-800/50 rounded-xl p-5">
        <div className="h-4 w-36 rounded-xl bg-white/5" />
        <div className="h-4 w-48 mt-3 rounded-xl bg-white/5" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-full mt-2 rounded-xl bg-white/5" />
        ))}
        <div className="h-10 w-full mt-4 rounded-xl bg-white/5" />
      </div>
    </div>
  )
}
