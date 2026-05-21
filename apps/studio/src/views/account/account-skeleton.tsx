export default function AccountSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 w-24 rounded-xl bg-white/5" />
      <div className="h-10 w-28 rounded-xl bg-white/5" />
      <div className="space-y-5">
        <div className="space-y-1.5">
          <div className="h-3 w-16 rounded-xl bg-white/5" />
          <div className="h-10 w-full rounded-xl bg-white/5" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-20 rounded-xl bg-white/5" />
          <div className="h-10 w-full rounded-xl bg-white/5" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-white/5" />
      </div>
    </div>
  )
}
