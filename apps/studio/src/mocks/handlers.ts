import { http, HttpResponse } from 'msw'

const MOCK_NOW = new Date('2026-05-19T12:00:00Z').toISOString()

const mockedAgents = [
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
    requirements: { 'node': 20, 'memory': 512 },
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
    executionStats: { total: 156, running: 2, failed: 8, latest: { id: 'exec-003', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW } },
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
    requirements: { 'node': 20 },
    systemPrompt: 'You are a research assistant.',
    stateSchema: null,
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
    executionStats: { total: 23, running: 0, failed: 1, latest: { id: 'exec-010', status: 'error', startedAt: MOCK_NOW, endedAt: MOCK_NOW } },
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
    requirements: { 'node': 20, 'memory': 256 },
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
    executionStats: { total: 1042, running: 0, failed: 15, latest: { id: 'exec-050', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW } },
  },
]

const mockChatMessages: Record<string, { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: string; executionId?: string }[]> = {
  'chat-session-1': [
    { id: 'msg-1', role: 'user', content: 'I need a refund for my recent purchase.', createdAt: MOCK_NOW },
    { id: 'msg-2', role: 'assistant', content: 'I can help with that! Let me look up your account. Could you provide your order ID?', createdAt: MOCK_NOW },
    { id: 'msg-3', role: 'user', content: 'Sure, it\'s ORD-2026-4832.', createdAt: MOCK_NOW },
    { id: 'msg-4', role: 'assistant', content: 'Found it! I see your order was placed on May 15th. Since it\'s within the 30-day refund window, I can process the refund. Let me initiate that for you.', createdAt: MOCK_NOW, executionId: 'exec-003' },
  ],
  'chat-session-2': [
    { id: 'msg-5', role: 'user', content: 'We\'re seeing high latency on the API gateway.', createdAt: MOCK_NOW },
    { id: 'msg-6', role: 'assistant', content: 'Checking the metrics now. I can see the gateway latency spiked to 2.3s at 11:45 UTC. Let me run a diagnostics check.', createdAt: MOCK_NOW },
    { id: 'msg-7', role: 'assistant', content: 'Diagnostics complete. The issue appears to be related to the database connection pool being exhausted. Currently 47/50 connections in use.', createdAt: MOCK_NOW },
  ],
  'chat-session-3': [
    { id: 'msg-8', role: 'user', content: 'Can you generate a weekly uptime report?', createdAt: MOCK_NOW },
  ],
}

const mockExecutions: Record<string, { id: string; agentName: string; trigger: unknown; status: 'running' | 'completed' | 'error'; startedAt: string; endedAt: string | null; durationMs: number | null; error: string | null; outputText?: string }[]> = {
  'support': [
    { id: 'exec-001', agentName: 'support', trigger: 'POST /api/tickets', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 342, error: null, outputText: 'Ticket created successfully' },
    { id: 'exec-002', agentName: 'support', trigger: 'ticket:high-priority', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 1890, error: null, outputText: 'Escalated to senior agent' },
    { id: 'exec-003', agentName: 'support', trigger: 'message hook', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 567, error: null, outputText: 'Refund processed for order ORD-2026-4832' },
    { id: 'exec-004', agentName: 'support', trigger: 'GET /api/tickets', status: 'running', startedAt: MOCK_NOW, endedAt: null, durationMs: null, error: null },
    { id: 'exec-005', agentName: 'support', trigger: '0 8 * * *', status: 'error', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 12000, error: 'Database connection timeout after 10s' },
  ],
  'researcher': [
    { id: 'exec-010', agentName: 'researcher', trigger: 'GET /api/search', status: 'error', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 30000, error: 'External API rate limit exceeded' },
  ],
  'monitor': [
    { id: 'exec-050', agentName: 'monitor', trigger: '*/5 * * * *', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 234, error: null, outputText: 'All 12 services healthy (99.97% uptime)' },
  ],
}

const mockExecutionEvents: Record<string, { id: string; executionId: string; type: string; timestamp: string; payload: unknown }[]> = {
  'exec-003': [
    { id: 'evt-001', executionId: 'exec-003', type: 'execution_started', timestamp: MOCK_NOW, payload: { agentName: 'support', trigger: 'message hook' } },
    { id: 'evt-002', executionId: 'exec-003', type: 'node_started', timestamp: MOCK_NOW, payload: { nodeId: 'lookup_order', label: 'Look Up Order', durationMs: 120 } },
    { id: 'evt-003', executionId: 'exec-003', type: 'node_completed', timestamp: MOCK_NOW, payload: { nodeId: 'lookup_order', result: 'Order #ORD-2026-4832 found (status: delivered)', durationMs: 118 } },
    { id: 'evt-004', executionId: 'exec-003', type: 'state_patch', timestamp: MOCK_NOW, payload: { key: 'refundInProgress', value: 'true' } },
    { id: 'evt-005', executionId: 'exec-003', type: 'contract_call', timestamp: MOCK_NOW, payload: { contract: 'get-user', params: { userId: 'usr_8f3a2' }, durationMs: 89 } },
    { id: 'evt-006', executionId: 'exec-003', type: 'tool_call', timestamp: MOCK_NOW, payload: { tool: 'process_refund', args: { orderId: 'ORD-2026-4832', amount: 49.99 }, durationMs: 245 } },
    { id: 'evt-007', executionId: 'exec-003', type: 'tool_result', timestamp: MOCK_NOW, payload: { tool: 'process_refund', result: 'Refund approved: $49.99 will be returned within 5-7 business days' } },
    { id: 'evt-008', executionId: 'exec-003', type: 'emit', timestamp: MOCK_NOW, payload: { event: 'ticket:resolved', data: { ticketId: 'TKT-4832', resolution: 'refunded' } } },
    { id: 'evt-009', executionId: 'exec-003', type: 'execution_finished', timestamp: MOCK_NOW, payload: { status: 'completed', durationMs: 567, outputText: 'Refund processed for order ORD-2026-4832' } },
  ],
}

export const handlers = [
  http.get('/api/internal/session', () => {
    return HttpResponse.json({
      authenticated: true,
      user: { username: 'admin' },
    })
  }),

  http.post('/api/internal/auth', async ({ request }) => {
    const body = await request.json() as { username?: string; password?: string }
    return HttpResponse.json({
      ok: true,
      user: { username: body?.username ?? 'admin' },
    })
  }),

  http.post('/api/internal/logout', () => {
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/internal/runtime/system', () => {
    return HttpResponse.json({
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
  }),

  http.get('/api/internal/agents', () => {
    return HttpResponse.json({
      generatedAt: MOCK_NOW,
      projectPath: '/workspace/mock',
      workerUrl: 'https://kalp-support.workers.dev',
      mode: 'local',
      agents: mockedAgents.map(({ routes, entrypoints, triggers, contracts, listeners, state, chat, chatSessions, executionStats, ...agent }) => agent),
    })
  }),

  http.get('/api/internal/agents/:agentName', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    if (!agent) {
      return HttpResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return HttpResponse.json(agent)
  }),

  http.get('/api/internal/agents/:agentName/state', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    if (!agent) {
      return HttpResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return HttpResponse.json(agent.state)
  }),

  http.get('/api/internal/agents/:agentName/chat/sessions', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    if (!agent) {
      return HttpResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return HttpResponse.json(agent.chatSessions)
  }),

  http.get('/api/internal/agents/:agentName/chat/:sessionId/messages', ({ params }) => {
    const messages = mockChatMessages[params.sessionId as string]
    if (!messages) {
      return HttpResponse.json([])
    }
    return HttpResponse.json(messages)
  }),

  http.post('/api/internal/agents/:agentName/chat', async ({ params, request }) => {
    const body = await request.json() as { message?: string; sessionId?: string; stream?: boolean }
    const agentName = params.agentName as string
    const sessionId = body.sessionId ?? `chat-session-mock-${Date.now()}`
    const messageId = `msg-mock-${Date.now()}`
    const executionId = `exec-mock-${Date.now()}`

    if (!mockChatMessages[sessionId]) {
      mockChatMessages[sessionId] = []
    }
    mockChatMessages[sessionId].push({
      id: messageId,
      role: 'user',
      content: body.message ?? '',
      createdAt: new Date().toISOString(),
    })
    mockChatMessages[sessionId].push({
      id: `msg-mock-resp-${Date.now()}`,
      role: 'assistant',
      content: `This is a mock response to: "${body.message ?? ''}"`,
      createdAt: new Date().toISOString(),
      executionId,
    })

    return HttpResponse.json({
      session: { id: sessionId, agentName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      executionId,
      message: { id: messageId, role: 'user', content: body.message ?? '', createdAt: new Date().toISOString() },
      stream: body.stream ?? false,
    })
  }),

  http.get('/api/internal/agents/:agentName/executions', ({ params }) => {
    return HttpResponse.json(mockExecutions[params.agentName as string] ?? [])
  }),

  http.get('/api/internal/agents/:agentName/executions/:executionId', ({ params }) => {
    const agentExecs = mockExecutions[params.agentName as string] ?? []
    const exec = agentExecs.find((e) => e.id === params.executionId)
    if (!exec) {
      return HttpResponse.json({ error: 'Execution not found' }, { status: 404 })
    }
    return HttpResponse.json(exec)
  }),

  http.get('/api/internal/agents/:agentName/executions/:executionId/events', ({ params }) => {
    return HttpResponse.json(mockExecutionEvents[params.executionId as string] ?? [])
  }),

  http.get('/api/internal/executions', () => {
    const all = Object.values(mockExecutions).flat()
    return HttpResponse.json(all)
  }),

  http.get('/api/internal/events/:executionId', ({ params }) => {
    return HttpResponse.json(mockExecutionEvents[params.executionId as string] ?? [])
  }),

  http.get('/api/internal/agents/:agentName/entrypoints', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    return HttpResponse.json(agent?.entrypoints ?? [])
  }),

  http.get('/api/internal/agents/:agentName/routes', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    return HttpResponse.json(agent?.routes ?? [])
  }),

  http.get('/api/internal/agents/:agentName/triggers', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    return HttpResponse.json(agent?.triggers ?? [])
  }),

  http.get('/api/internal/agents/:agentName/contracts', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    return HttpResponse.json(agent?.contracts ?? [])
  }),

  http.get('/api/internal/agents/:agentName/chat-capabilities', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    return HttpResponse.json(agent?.chat ?? { supportsChat: false, supportsStreaming: false, supportsAttachments: false, supportsHistory: false })
  }),
]
