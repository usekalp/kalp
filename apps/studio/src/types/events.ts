/**
 * Event types for the Kalp Studio.
 * Mirrors types from @kalphq/core for UI consumption.
 *
 * @module
 */

/**
 * Serialized error for deterministic replay.
 */
export interface SerializedError {
  /** Error message */
  message: string
  /** Error name */
  name: string
  /** Optional stack trace */
  stack?: string
}

/**
 * A persisted intent event with optional result or error.
 */
export interface IntentEvent {
  /** Sequence number - assigned synchronously at call time for determinism */
  seq: number
  /** Event type (e.g., "intent.run_step", "intent.ai_generate") */
  type: string
  /** Execution identifier (this handler invocation) */
  executionId: string
  /** Trace identifier (this handleEvent call) */
  traceId: string
  /** Thread identifier (DO instance) */
  threadId: string
  /** Timestamp of the event */
  timestamp: number
  /** Input payload for the intent */
  payload: unknown
  /** Cached result (if execution completed) */
  result?: unknown
  /** Serialized error (if execution failed) */
  error?: SerializedError
  /** Status for long-running intents (e.g., "waiting" for HITL) */
  status?: string
}

/**
 * Summary of an execution for the dashboard list.
 */
export interface ExecutionSummary {
  /** Unique execution identifier */
  execution_id: string
  /** Thread/Durable Object identifier */
  thread_id: string
  /** Agent name */
  agent_name: string
  /** Current execution status */
  status: 'running' | 'suspended' | 'completed' | 'error'
  /** Start timestamp */
  started_at: number
  /** End timestamp (null if running) */
  ended_at: number | null
  /** Number of events in this execution */
  event_count: number
}

/**
 * State of the replay playback controls.
 */
export interface ReplayState {
  /** Current sequence number being displayed */
  currentSeq: number
  /** Total number of events */
  totalEvents: number
  /** Whether replay is actively playing */
  isPlaying: boolean
  /** Playback speed multiplier */
  speed: 0.5 | 1 | 2 | 4
}
