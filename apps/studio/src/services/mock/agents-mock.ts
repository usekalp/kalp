import type {
  RuntimeAgentDetails,
  RuntimeAgentsResponse,
  RuntimeAgentState,
  RuntimeChatCapabilities,
  RuntimeContract,
  RuntimeEntrypoint,
  RuntimeListener,
  RuntimeRoute,
  RuntimeSystemStatus,
  RuntimeTrigger,
} from '#/types/agents'

const MOCK_NOW = new Date('2026-05-19T12:00:00Z').toISOString()

const mockedAgents: (RuntimeAgentDetails & {
  listeners: RuntimeListener[]
  chatSessions: { id: string; agentName: string; createdAt: string; updatedAt: string; title?: string }[]
  executionStats: { total: number; running: number; failed: number; successful?: number; latest: { id: string; status: string; startedAt: string | null; endedAt: string | null } | null }
})[] = [
  {
    name: 'support',
    label: 'Support Agent',
    description: 'Handles customer inquiries, ticket routing, and knowledge base retrieval.',
    tags: ['customer-service', 'routing', 'production'],
    environment: 'both' as const,
    status: 'online' as const,
    hash: 'a1b2c3d4e5f6',
    version: 'v3',
    versionNumber: 3,
    lastRemoteHash: 'a1b2c3d4e5f6',
    lastLocalHash: 'a1b2c3d4e5f6',
    workerUrl: 'https://kalp-support.workers.dev/a/support',
    localPath: '/workspace/agents/support/index.ts',
    updatedAt: MOCK_NOW,
    public: false,
    requirements: { node: 20, memory: 512 },
    systemPrompt: 'You are a helpful support agent.',
    stateSchema: 'support-state-schema-v1',
    routes: [
      { id: 'route-1', stableName: 'ticket-create', name: 'Create Ticket', method: 'POST', path: '/api/tickets', public: true },
      { id: 'route-2', stableName: 'ticket-list', name: 'List Tickets', method: 'GET', path: '/api/tickets', public: false },
      { id: 'route-3', stableName: 'ticket-get', name: 'Get Ticket', method: 'GET', path: '/api/tickets/:id', public: false },
    ],
    entrypoints: [
      { id: 'ep-1', stableName: 'create-ticket', kind: 'route' as const, title: 'Create Ticket', method: 'POST', path: '/api/tickets' },
      { id: 'ep-2', stableName: 'on-ticket-created', kind: 'listener' as const, title: 'On Ticket Created' },
      { id: 'ep-3', stableName: 'escalate-ticket', kind: 'hook' as const, title: 'Escalate Ticket' },
    ],
    triggers: [
      { id: 'tr-1', stableName: 'daily-report', type: 'schedule' as const, expression: '0 8 * * *', timezone: 'UTC' },
      { id: 'tr-2', stableName: 'on-high-priority', type: 'listener' as const, event: 'ticket:high-priority' },
    ],
    contracts: [
      { id: 'ct-1', stableName: 'get-user', name: 'Get User Profile' },
      { id: 'ct-2', stableName: 'escalation-rules', name: 'Escalation Rules' },
    ],
    listeners: [
      { id: 'li-1', stableName: 'ticket-created-listener', event: 'ticket:created', name: 'Ticket Created Listener' },
    ],
    state: {
      agentName: 'support',
      schemaId: 'support-state-v1',
      schema: { type: 'object', properties: { openTickets: { type: 'number' }, avgResponseTime: { type: 'number' } } },
      snapshot: { openTickets: 42, avgResponseTimeMs: 1250, resolvedToday: 18, escalatedCount: 3 },
      availability: { supported: true },
      summary: [
        { key: 'open_tickets', value: '42' },
        { key: 'avg_response_time_ms', value: '1250' },
        { key: 'resolved_today', value: '18' },
      ],
      updatedAt: MOCK_NOW,
    },
    chat: { supportsChat: true, supportsStreaming: true, supportsAttachments: false, supportsHistory: true },
    chatSessions: [
      { id: 'chat-session-1', agentName: 'support', createdAt: MOCK_NOW, updatedAt: MOCK_NOW, title: 'Refund inquiry' },
    ],
    executionStats: { total: 156, running: 2, failed: 8, successful: 146, latest: { id: 'exec-003', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW } },
  },
  {
    name: 'researcher',
    label: 'Research Assistant',
    description: 'Web research, document summarization, and data extraction.',
    tags: ['research', 'data-extraction'],
    environment: 'local' as const,
    status: 'offline' as const,
    hash: 'z9y8x7w6v5u4',
    version: 'v1',
    versionNumber: 1,
    lastRemoteHash: null,
    lastLocalHash: 'z9y8x7w6v5u4',
    workerUrl: null,
    localPath: '/workspace/agents/researcher/index.ts',
    updatedAt: MOCK_NOW,
    public: false,
    requirements: { node: 20 },
    systemPrompt: 'You are a research assistant.',
    stateSchema: undefined,
    routes: [
      { id: 'route-4', stableName: 'research-search', name: 'Search', method: 'GET', path: '/api/search', public: true },
    ],
    entrypoints: [
      { id: 'ep-4', stableName: 'web-search', kind: 'route' as const, title: 'Web Search', method: 'GET', path: '/api/search' },
    ],
    triggers: [],
    contracts: [],
    listeners: [],
    state: {
      agentName: 'researcher',
      schemaId: null,
      schema: null,
      snapshot: { lastQuery: null, cachedResults: 0 },
      availability: { supported: true },
      summary: [
        { key: 'cached_results', value: '0' },
        { key: 'last_query', value: 'none' },
      ],
      updatedAt: MOCK_NOW,
    },
    chat: { supportsChat: false, supportsStreaming: false, supportsAttachments: false, supportsHistory: false },
    chatSessions: [],
    executionStats: { total: 23, running: 0, failed: 1, successful: 22, latest: { id: 'exec-010', status: 'error', startedAt: MOCK_NOW, endedAt: MOCK_NOW } },
  },
  {
    name: 'monitor',
    label: 'System Monitor',
    description: 'Infrastructure monitoring, alerting, and health checks across services.',
    tags: ['monitoring', 'infrastructure', 'alerts'],
    environment: 'remote' as const,
    status: 'online' as const,
    hash: 'm1n2b3v4c5x6',
    version: 'v5',
    versionNumber: 5,
    lastRemoteHash: 'm1n2b3v4c5x6',
    lastLocalHash: 'm1n2b3v4c5x6',
    workerUrl: 'https://kalp-monitor.workers.dev/a/monitor',
    localPath: '/workspace/agents/monitor/index.ts',
    updatedAt: MOCK_NOW,
    public: true,
    requirements: { node: 20, memory: 256 },
    systemPrompt: 'You are a system monitoring agent.',
    stateSchema: 'monitor-state-schema-v2',
    routes: [
      { id: 'route-5', stableName: 'health-check', name: 'Health Check', method: 'GET', path: '/health', public: true },
      { id: 'route-6', stableName: 'alerts-list', name: 'List Alerts', method: 'GET', path: '/api/alerts', public: false },
    ],
    entrypoints: [
      { id: 'ep-5', stableName: 'health-endpoint', kind: 'route' as const, title: 'Health Endpoint', method: 'GET', path: '/health' },
      { id: 'ep-6', stableName: 'on-service-down', kind: 'hook' as const, title: 'On Service Down' },
      { id: 'ep-7', stableName: 'weekly-report', kind: 'listener' as const, title: 'Weekly Report' },
    ],
    triggers: [
      { id: 'tr-3', stableName: 'health-check-cron', type: 'schedule' as const, expression: '*/5 * * * *', timezone: 'UTC' },
    ],
    contracts: [
      { id: 'ct-3', stableName: 'incident-report', name: 'Incident Report' },
    ],
    listeners: [
      { id: 'li-2', stableName: 'service-down-listener', event: 'service:down', name: 'Service Down Listener' },
      { id: 'li-3', stableName: 'deploy-listener', event: 'deploy:completed', name: 'Deploy Completed Listener' },
    ],
    state: {
      agentName: 'monitor',
      schemaId: 'monitor-state-v2',
      schema: { type: 'object', properties: { uptime: { type: 'number' }, activeAlerts: { type: 'number' } } },
      snapshot: { uptime: 99.97, activeAlerts: 3, servicesChecked: 12, servicesHealthy: 11 },
      availability: { supported: true },
      summary: [
        { key: 'uptime_pct', value: '99.97' },
        { key: 'active_alerts', value: '3' },
        { key: 'services_healthy', value: '11 / 12' },
      ],
      updatedAt: MOCK_NOW,
    },
    chat: { supportsChat: true, supportsStreaming: false, supportsAttachments: true, supportsHistory: true },
    chatSessions: [
      { id: 'chat-session-2', agentName: 'monitor', createdAt: MOCK_NOW, updatedAt: MOCK_NOW, title: 'Alert investigation' },
      { id: 'chat-session-3', agentName: 'monitor', createdAt: MOCK_NOW, updatedAt: MOCK_NOW, title: 'Uptime report' },
    ],
    executionStats: { total: 1042, running: 0, failed: 15, successful: 1027, latest: { id: 'exec-050', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW } },
  },
]

export function mockGetAgents(): Promise<RuntimeAgentsResponse> {
  return Promise.resolve({
    generatedAt: MOCK_NOW,
    projectPath: '/workspace/mock',
    workerUrl: 'https://kalp-support.workers.dev',
    mode: 'local',
    agents: mockedAgents.map(
      ({ routes, entrypoints, triggers, contracts, listeners, state, chat, chatSessions, executionStats, ...agent }) => agent,
    ),
  })
}

export function mockGetAgent(agentName: string): Promise<RuntimeAgentDetails> {
  const agent = mockedAgents.find((entry) => entry.name === agentName)
  if (!agent) return Promise.reject(new Error('Agent not found'))
  const { chatSessions, executionStats, ...details } = agent
  return Promise.resolve(details as RuntimeAgentDetails)
}

export function mockGetAgentEntrypoints(agentName: string): Promise<RuntimeEntrypoint[]> {
  const agent = mockedAgents.find((entry) => entry.name === agentName)
  return Promise.resolve(agent?.entrypoints ?? [])
}

export function mockGetAgentRoutes(agentName: string): Promise<RuntimeRoute[]> {
  const agent = mockedAgents.find((entry) => entry.name === agentName)
  return Promise.resolve(agent?.routes ?? [])
}

export function mockGetAgentTriggers(agentName: string): Promise<RuntimeTrigger[]> {
  const agent = mockedAgents.find((entry) => entry.name === agentName)
  return Promise.resolve(agent?.triggers ?? [])
}

export function mockGetAgentContracts(agentName: string): Promise<RuntimeContract[]> {
  const agent = mockedAgents.find((entry) => entry.name === agentName)
  return Promise.resolve(agent?.contracts ?? [])
}

export function mockGetAgentState(agentName: string): Promise<RuntimeAgentState> {
  const agent = mockedAgents.find((entry) => entry.name === agentName)
  if (!agent) return Promise.reject(new Error('Agent not found'))
  return Promise.resolve(agent.state)
}

export function mockGetAgentChatCapabilities(agentName: string): Promise<RuntimeChatCapabilities> {
  const agent = mockedAgents.find((entry) => entry.name === agentName)
  return Promise.resolve(
    agent?.chat ?? { supportsChat: false, supportsStreaming: false, supportsAttachments: false, supportsHistory: false },
  )
}

export function mockGetRuntimeSystemStatus(): Promise<RuntimeSystemStatus> {
  return Promise.resolve({
    runtimeMode: 'local',
    studioMode: 'live-workspace',
    agentCount: mockedAgents.length,
    supportsChat: true,
    supportsReplay: true,
    supportsState: true,
    supportsSubscriptions: {
      agents: 'polling',
      state: 'polling',
      executions: 'polling',
      executionEvents: 'polling',
      chatSession: 'polling',
    },
  })
}
