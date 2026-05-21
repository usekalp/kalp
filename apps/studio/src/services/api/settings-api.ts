export async function getSecrets(): Promise<
  { key: string; value: string; updatedAt: string }[]
> {
  return []
}

export async function saveSecret(_key: string, _value: string): Promise<void> {}

export async function deleteSecret(_key: string): Promise<void> {}

export async function getMcpServers(): Promise<any[]> {
  return []
}
