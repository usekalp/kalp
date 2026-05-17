import type { RuntimeSystemStatus } from '#/types/agents'
import { runtimeRequest } from './request'

export function getRuntimeSystemStatus(): Promise<RuntimeSystemStatus> {
  return runtimeRequest('/runtime/system', { method: 'GET' })
}
