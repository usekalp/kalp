import type { StoryDefault } from '@ladle/react'
import { Badge } from './badge'

export default {
  title: 'Primitives/Badge',
} satisfies StoryDefault

export const Default = () => (
  <Badge>Default</Badge>
)

export const Secondary = () => (
  <Badge variant="secondary">Secondary</Badge>
)

export const Destructive = () => (
  <Badge variant="destructive">Destructive</Badge>
)

export const Outline = () => (
  <Badge variant="outline">Outline</Badge>
)

export const All = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge>Default</Badge>
    <Badge variant="secondary">Secondary</Badge>
    <Badge variant="destructive">Destructive</Badge>
    <Badge variant="outline">Outline</Badge>
  </div>
)
