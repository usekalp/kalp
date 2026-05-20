import type { StoryDefault } from '@ladle/react'
import { Input } from './input'

export default {
  title: 'Primitives/Input',
} satisfies StoryDefault

export const Default = () => (
  <Input placeholder="Type something..." />
)

export const Disabled = () => (
  <Input disabled placeholder="Disabled" />
)

export const File = () => (
  <Input type="file" />
)
