export interface RuntimeAgent {
  name: string
  environment: 'local' | 'remote' | 'both'
  status: 'online' | 'offline'
  hash: string | null
  workerUrl: string | null
  localPath: string | null
  updatedAt: string | null
}

export interface RuntimeAgentsResponse {
  generatedAt: string
  projectPath: string
  workerUrl: string | null
  agents: RuntimeAgent[]
}
