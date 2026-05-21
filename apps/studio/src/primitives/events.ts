/// Timeline event types — structure reserved for runtime integration
/// These types are defined now so the Activity tab can be built
/// against a stable contract. Records will be populated when the
/// runtime emits typed events.

export type TimelineEventType =
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
  | 'sleep'
  | 'wake'
  | 'ask'
  | 'stream_chunk'

export type WakeReason =
  | 'timer'
  | 'event'
  | 'message'
  | 'approval'
  | 'error'

export type TransportType =
  | 'internal'
  | 'http'
  | 'ws'
  | 'sse'
