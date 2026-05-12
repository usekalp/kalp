import { http, HttpResponse } from 'msw'

const mockedAgents = [
  {
    name: 'support',
    label: 'Support',
    environment: 'both',
    status: 'online',
    hash: 'a1b2c3d4',
    version: 'v3',
    versionNumber: 3,
    lastRemoteHash: 'a1b2c3d4',
    lastLocalHash: 'a1b2c3d4',
    workerUrl: 'https://kalp-support.workers.dev/a/support',
    localPath: '/workspace/agents/support/index.ts',
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'researcher',
    label: 'Researcher',
    environment: 'local',
    status: 'offline',
    hash: 'z9y8x7w6',
    version: 'v1',
    versionNumber: 1,
    lastRemoteHash: null,
    lastLocalHash: 'z9y8x7w6',
    workerUrl: null,
    localPath: '/workspace/agents/researcher/index.ts',
    updatedAt: new Date().toISOString(),
  },
]

export const handlers = [
  http.get('/api/internal/session', () => {
    return HttpResponse.json({
      authenticated: true,
      user: { username: 'admin' },
    })
  }),

  http.post('/api/internal/auth', async () => {
    return HttpResponse.json({
      ok: true,
      user: { username: 'admin' },
    })
  }),

  http.post('/api/internal/logout', () => {
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/internal/agents', () => {
    return HttpResponse.json({
      generatedAt: new Date().toISOString(),
      projectPath: '/workspace/mock',
      workerUrl: 'https://kalp-support.workers.dev',
      mode: 'local',
      agents: mockedAgents,
    })
  }),

  http.get('/api/internal/agents/:agentName', ({ params }) => {
    const agent = mockedAgents.find((entry) => entry.name === params.agentName)
    if (!agent) {
      return HttpResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return HttpResponse.json(agent)
  }),

  http.get('/api/internal/executions', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/internal/events/:executionId', () => {
    return HttpResponse.json([])
  }),
]
