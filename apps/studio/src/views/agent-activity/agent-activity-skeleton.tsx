export default function AgentActivitySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="h-6 w-6 rounded-full bg-white/5 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded-xl bg-white/5" />
            <div className="flex gap-3">
              <div className="h-3 w-24 rounded-xl bg-white/5" />
              <div className="h-3 w-16 rounded-xl bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
