export interface ExecutionSummary {
  id: string
  agentName: string
  trigger: unknown
  status: 'running' | 'completed' | 'error'
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  error: string | null
  outputText?: string
}

export interface ExecutionEvent {
  id: string
  executionId: string
  type:
    | 'execution_started'
    | 'execution_finished'
    | 'node_started'
    | 'node_completed'
    | 'emit'
    | 'dispatch'
    | 'tool_call'
    | 'tool_result'
    | 'contract_call'
    | 'state_patch'
    | 'retry'
    | 'log'
    | 'error'
    | 'token'
  timestamp: string
  payload: unknown
}

export interface ReplayState {
  currentSeq: number
  totalEvents: number
  isPlaying: boolean
  speed: 0.5 | 1 | 2 | 4
}
