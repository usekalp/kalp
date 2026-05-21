import type { ChatMessage } from '../types'

export function groupMessagesByThread(messages: ChatMessage[]): ChatMessage[][] {
  const threads: ChatMessage[][] = []
  let current: ChatMessage[] = []
  for (const msg of messages) {
    if (msg.role === 'user' && current.length > 0) {
      threads.push(current)
      current = []
    }
    current.push(msg)
  }
  if (current.length > 0) threads.push(current)
  return threads
}
