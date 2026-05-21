export default function ReplaySkeleton() {
  return (
    <div className="h-screen flex flex-col animate-pulse">
      <div className="h-20 rounded-xl border border-zinc-800/50 bg-white/5 mb-4" />
      <div className="flex-1 rounded-xl border border-zinc-800/50 p-4">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 h-16 border-b border-zinc-800/50">
              <div className="h-6 w-6 rounded-full bg-white/5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-48 rounded-xl bg-white/5" />
                <div className="h-3 w-32 rounded-xl bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-16 rounded-xl border border-zinc-800/50 bg-white/5 mt-4" />
    </div>
  )
}
