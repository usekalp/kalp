import type { StoryDefault } from '@ladle/react'
import { Skeleton } from './skeleton'

export default {
  title: 'Primitives/Skeleton',
} satisfies StoryDefault

export const Default = () => (
  <div className="space-y-3">
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-4 w-36" />
    <Skeleton className="h-4 w-56" />
  </div>
)

export const CardSkeleton = () => (
  <div className="rounded-5 border border-white/10 bg-black/25 p-4 space-y-3 w-72">
    <Skeleton className="h-5 w-24" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
)
