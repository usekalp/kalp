import type { RuntimeChatCapabilities } from '../types'

export function deriveCapabilityList(caps: RuntimeChatCapabilities): { label: string; supported: boolean }[] {
  return [
    { label: 'Message hook', supported: caps.supportsChat },
    { label: 'Streaming', supported: caps.supportsStreaming },
    { label: 'Attachments', supported: caps.supportsAttachments },
    { label: 'History', supported: caps.supportsHistory },
  ]
}
