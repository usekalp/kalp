import type { ExecutionEvent, ExecutionSummary } from '#/types/events'

const MOCK_NOW = new Date('2026-05-19T12:00:00Z').toISOString()

const mockExecutions: Record<
  string,
  {
    id: string
    agentName: string
    trigger: unknown
    status: 'running' | 'completed' | 'error'
    startedAt: string
    endedAt: string | null
    durationMs: number | null
    error: string | null
    outputText?: string
  }[]
> = {
  support: [
    { id: 'exec-001', agentName: 'support', trigger: 'POST /api/tickets', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 342, error: null, outputText: 'Ticket created successfully' },
    { id: 'exec-002', agentName: 'support', trigger: 'ticket:high-priority', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 1890, error: null, outputText: 'Escalated to senior agent' },
    { id: 'exec-003', agentName: 'support', trigger: 'message hook', status: 'completed', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 567, error: null, outputText: 'Refund processed for order ORD-2026-4832' },
    { id: 'exec-004', agentName: 'support', trigger: 'GET /api/tickets', status: 'running', startedAt: MOCK_NOW, endedAt: null, durationMs: null, error: null },
    { id: 'exec-005', agentName: 'support', trigger: '0 8 * * *', status: 'error', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 12000, error: 'Database connection timeout after 10s' },
  ],
  researcher: [
    { id: 'exec-010', agentName: 'researcher', trigger: 'GET /api/search', status: 'error', startedAt: MOCK_NOW, endedAt: MOCK_NOW, durationMs: 30000, error: 'External API rate limit exceeded' },
  ],
  monitor: [
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

export function mockGetExecutions(agentName?: string): Promise<ExecutionSummary[]> {
  if (agentName) {
    return Promise.resolve((mockExecutions[agentName] ?? []) as ExecutionSummary[])
  }
  const all = Object.values(mockExecutions).flat()
  return Promise.resolve(all as ExecutionSummary[])
}

export function mockGetExecution(executionId: string, agentName?: string): Promise<ExecutionSummary> {
  if (agentName) {
    const agentExecs = mockExecutions[agentName] ?? []
    const exec = agentExecs.find((e) => e.id === executionId)
    if (!exec) return Promise.reject(new Error('Execution not found'))
    return Promise.resolve(exec as ExecutionSummary)
  }
  const all = Object.values(mockExecutions).flat()
  const exec = all.find((e) => e.id === executionId)
  if (!exec) return Promise.reject(new Error('Execution not found'))
  return Promise.resolve(exec as ExecutionSummary)
}

export function mockGetExecutionEvents(
  executionId: string,
  _options?: { agentName?: string; threadId?: string },
): Promise<ExecutionEvent[]> {
  const raw = mockExecutionEvents[executionId] ?? []
  return Promise.resolve(
    raw.map((e) => ({
      ...e,
      type: e.type as ExecutionEvent['type'],
    })) as ExecutionEvent[],
  )
}
