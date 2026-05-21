export function groupEventsByTrace(events: any[]): Map<string, any[]> {
  const traces = new Map<string, any[]>()
  for (const event of events) {
    const traceId = (event as any).executionId ?? 'default'
    if (!traces.has(traceId)) traces.set(traceId, [])
    traces.get(traceId)!.push(event)
  }
  return traces
}
