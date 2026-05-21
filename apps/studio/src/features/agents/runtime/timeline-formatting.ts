export function formatEventType(type: string): string {
  return type.replace(/_/g, ' ')
}

export function resolveEventVariant(type: string): string {
  const errorTypes = ['error', 'execution_error']
  const startEnd = ['execution_started', 'execution_finished', 'node_started', 'node_completed']
  if (errorTypes.includes(type)) return 'destructive'
  if (startEnd.includes(type)) return 'secondary'
  return 'default'
}
