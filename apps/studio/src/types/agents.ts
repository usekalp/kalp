export interface RuntimeAgent {
  name: string
  environment: 'local' | 'remote' | 'both'
  status: 'online' | 'offline'
  hash: string | null
  version: string | null
  versionNumber: number | null
  lastRemoteHash: string | null
  lastLocalHash: string | null
  workerUrl: string | null
  localPath: string | null
  updatedAt: string | null
}

export interface RuntimeAgentsResponse {
  generatedAt: string
  projectPath: string
  workerUrl: string | null
  mode: 'local' | 'remote'
  agents: RuntimeAgent[]
}
