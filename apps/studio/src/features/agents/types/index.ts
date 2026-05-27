export type RuntimeEnvironment = 'local' | 'remote' | 'both'

export type RuntimeStatus = 'online' | 'offline'

export interface RuntimeAgent {
  name: string
  label?: string
  description?: string
  tags?: string[]
  environment: RuntimeEnvironment
  status: RuntimeStatus
  hash: string | null
  version: string | null
  versionNumber: number | null
  lastRemoteHash: string | null
  lastLocalHash: string | null
  workerUrl: string | null
  localPath: string | null
  updatedAt: string | null
  public?: boolean
  requirements?: Record<string, number>
  systemPrompt?: string
  stateSchema?: string
}

export interface RuntimeRoute {
  id: string
  stableName?: string
  name?: string
  method: string
  path: string
  public: boolean
}

export interface RuntimeEntrypoint {
  id: string
  stableName?: string
  kind: 'route' | 'contract' | 'listener' | 'hook'
  title: string
  method?: string
  path?: string
}

export interface RuntimeTrigger {
  id: string
  stableName?: string
  type: 'schedule' | 'listener' | 'hook'
  expression?: string
  timezone?: string
  event?: string
}

export interface RuntimeContract {
  id: string
  stableName?: string
  name?: string
}

export interface RuntimeListener {
  id: string
  stableName?: string
  event: string
  name?: string
}

export interface RuntimeStateSummaryItem {
  key: string
  value: string
}

export interface RuntimeAgentState {
  agentName: string
  schemaId: string | null
  schema: Record<string, unknown> | null
  snapshot: Record<string, unknown> | null
  availability: {
    supported: boolean
    reason?: string
  }
  summary: RuntimeStateSummaryItem[]
  updatedAt: string | null
}

export interface RuntimeChatCapabilities {
  supportsChat: boolean
  supportsStreaming: boolean
  supportsAttachments: boolean
  supportsHistory: boolean
}

export interface ChatSession {
  id: string
  agentName: string
  createdAt: string
  updatedAt: string
  title?: string
  metadata?: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  executionId?: string
  status?: string
}

export interface HandlerLocationEntry {
  file: string
  line: number
  column: number
  exportName: string
  stableName: string
  nodeId: string
}

export interface SourceLocationEntry {
  file: string
  line: number
  column: number
  handlerId: string
  primitiveType: string
}

export interface SourceMetadataManifest {
  schemaVersion: 1
  primitiveLocations: Record<string, SourceLocationEntry>
  handlerLocations: Record<string, HandlerLocationEntry>
}

export interface RuntimeAgentExecutionStats {
  total: number
  running: number
  failed: number
  successful: number
  latest: {
    id: string
    status: string
    startedAt: string | null
    endedAt: string | null
  } | null
}

export interface RuntimeAgentDetails extends RuntimeAgent {
  routes: RuntimeRoute[]
  entrypoints: RuntimeEntrypoint[]
  triggers: RuntimeTrigger[]
  contracts: RuntimeContract[]
  listeners: RuntimeListener[]
  state: RuntimeAgentState
  chat: RuntimeChatCapabilities
  chatSessions: ChatSession[]
  sourceMetadata: SourceMetadataManifest | null
  executionStats: RuntimeAgentExecutionStats
}

export interface RuntimeAgentsResponse {
  generatedAt: string
  projectPath: string
  workerUrl: string | null
  mode: 'local' | 'remote'
  agents: RuntimeAgent[]
}
