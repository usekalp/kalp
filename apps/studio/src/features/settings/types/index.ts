export interface Secret {
  key: string
  value: string
  updatedAt: string
}

export interface AiProvider {
  id: string
  label: string
}

export interface McpServer {
  name: string
  description: string
}
