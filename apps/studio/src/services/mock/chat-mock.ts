import type { ChatMessage, ChatSession } from '#/types/agents'

const MOCK_NOW = new Date('2026-05-19T12:00:00Z').toISOString()

const mockChatMessages: Record<
  string,
  { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: string; executionId?: string }[]
> = {
  'chat-session-1': [
    { id: 'msg-1', role: 'user', content: 'I need a refund for my recent purchase.', createdAt: MOCK_NOW },
    { id: 'msg-2', role: 'assistant', content: 'I can help with that! Let me look up your account. Could you provide your order ID?', createdAt: MOCK_NOW },
    { id: 'msg-3', role: 'user', content: "Sure, it's ORD-2026-4832.", createdAt: MOCK_NOW },
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

export function mockGetChatSessions(agentName: string): Promise<ChatSession[]> {
  const sessions: Record<string, ChatSession[]> = {
    support: [{ id: 'chat-session-1', agentName: 'support', createdAt: MOCK_NOW, updatedAt: MOCK_NOW, title: 'Refund inquiry' }],
    monitor: [
      { id: 'chat-session-2', agentName: 'monitor', createdAt: MOCK_NOW, updatedAt: MOCK_NOW, title: 'Alert investigation' },
      { id: 'chat-session-3', agentName: 'monitor', createdAt: MOCK_NOW, updatedAt: MOCK_NOW, title: 'Uptime report' },
    ],
  }
  return Promise.resolve(sessions[agentName] ?? [])
}

export function mockGetChatMessages(_agentName: string, sessionId: string): Promise<ChatMessage[]> {
  const messages = mockChatMessages[sessionId]
  return Promise.resolve(messages ?? [])
}

export function mockSendChatMessage(input: {
  agentName: string
  message?: string
  sessionId?: string
  stream?: boolean
}): Promise<any> {
  const sessionId = input.sessionId ?? `chat-session-mock-${Date.now()}`
  const messageId = `msg-mock-${Date.now()}`
  const executionId = `exec-mock-${Date.now()}`

  if (!mockChatMessages[sessionId]) {
    mockChatMessages[sessionId] = []
  }
  mockChatMessages[sessionId].push({
    id: messageId,
    role: 'user',
    content: input.message ?? '',
    createdAt: new Date().toISOString(),
  })
  mockChatMessages[sessionId].push({
    id: `msg-mock-resp-${Date.now()}`,
    role: 'assistant',
    content: `This is a mock response to: "${input.message ?? ''}"`,
    createdAt: new Date().toISOString(),
    executionId,
  })

  return Promise.resolve({
    session: { id: sessionId, agentName: input.agentName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    executionId,
    message: { id: messageId, role: 'user', content: input.message ?? '', createdAt: new Date().toISOString() },
    stream: input.stream ?? false,
  })
}
