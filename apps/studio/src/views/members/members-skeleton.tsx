export default function MembersSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-16 rounded-xl bg-white/5" />
        <div className="h-10 w-32 rounded-xl bg-white/5" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl border border-zinc-800/50 flex items-center gap-3 px-4">
            <div className="h-8 w-8 rounded-full bg-white/5 shrink-0" />
            <div className="h-4 w-32 rounded-xl bg-white/5" />
            <div className="h-3 w-48 rounded-xl bg-white/5" />
            <div className="h-5 w-16 rounded-xl bg-white/5 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
