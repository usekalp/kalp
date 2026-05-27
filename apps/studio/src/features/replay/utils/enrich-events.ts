import type { ExecutionEvent, SourceLocation } from '../types'

export interface SourceMetadataManifest {
  schemaVersion: 1
  primitiveLocations: Record<string, { file: string; line: number; column: number; handlerId: string; primitiveType: string }>
  handlerLocations: Record<string, { file: string; line: number; column: number; exportName: string; stableName: string; nodeId: string }>
}

function resolveSourceLocation(
  payload: Record<string, unknown> | undefined,
  sourceMetadata: SourceMetadataManifest,
): SourceLocation | undefined {
  const primitiveId = payload?.primitiveId as string | undefined
  if (primitiveId) {
    const loc = sourceMetadata.primitiveLocations[primitiveId]
    if (loc) return { file: loc.file, line: loc.line, column: loc.column }
  }

  const nodeId = payload?.nodeId as string | undefined
  if (nodeId) {
    const loc = sourceMetadata.handlerLocations[nodeId]
    if (loc) return { file: loc.file, line: loc.line, column: loc.column }
  }

  return undefined
}

export function enrichEvents(
  events: ExecutionEvent[],
  sourceMetadata: SourceMetadataManifest | null | undefined,
): ExecutionEvent[] {
  if (!sourceMetadata) return events
  return events.map((event) => {
    const payload = event.payload as Record<string, unknown> | undefined
    const sourceLocation = resolveSourceLocation(payload, sourceMetadata)
    return sourceLocation ? { ...event, sourceLocation } : event
  })
}
