export async function mockGetSecrets() {
  return [
    { key: 'ANTHROPIC_API_KEY', value: 'sk-ant-••••••••••••', updatedAt: new Date().toISOString() },
    { key: 'OPENAI_API_KEY', value: 'sk-••••••••••••', updatedAt: new Date().toISOString() },
  ]
}

export async function mockSaveSecret(_key: string, _value: string) {
  return { ok: true } as const
}

export async function mockDeleteSecret(_key: string) {
  return { ok: true } as const
}

export async function mockGetMcpServers() {
  return []
}
