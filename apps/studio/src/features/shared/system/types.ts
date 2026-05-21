export interface RuntimeSystemStatus {
  runtimeMode: 'local' | 'remote'
  studioMode: 'live-workspace' | 'bundled-artifact'
  agentCount: number
  supportsChat: boolean
  supportsReplay: boolean
  supportsState: boolean
  supportsSubscriptions: {
    agents: string
    state: string
    executions: string
    executionEvents: string
    chatSession: string
  }
}
