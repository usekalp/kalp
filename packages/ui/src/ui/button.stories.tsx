import type { StoryDefault } from '@ladle/react'
import { Button } from './button'

export default {
  title: 'Primitives/Button',
} satisfies StoryDefault

export const Primary = () => (
  <Button>Primary</Button>
)

export const Secondary = () => (
  <Button variant="secondary">Secondary</Button>
)

export const Destructive = () => (
  <Button variant="destructive">Destructive</Button>
)

export const Outline = () => (
  <Button variant="outline">Outline</Button>
)

export const Ghost = () => (
  <Button variant="ghost">Ghost</Button>
)

export const Sizes = () => (
  <div className="flex items-center gap-3">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon">👤</Button>
  </div>
)

export const Disabled = () => (
  <Button disabled>Disabled</Button>
)
