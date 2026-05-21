export default function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-32 rounded-xl bg-white/5" />
      </div>
      <div className="flex items-start gap-3">
        <div className="w-80 space-y-1.5">
          <div className="h-10 w-80 rounded-xl bg-white/5" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-zinc-800/50 rounded-xl p-4">
            <div className="h-8 w-8 rounded-xl bg-white/5" />
            <div className="h-4 w-32 mt-3 rounded-xl bg-white/5" />
            <div className="h-3 w-full mt-2 rounded-xl bg-white/5" />
            <div className="h-3 w-3/4 mt-1.5 rounded-xl bg-white/5" />
            <div className="h-3 w-20 mt-3 rounded-xl bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
