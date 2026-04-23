import type { RunTargetKind } from "@kalphq/sdk";

export function toHandlerKey(kind: RunTargetKind, id: string): string {
  return `${kind}s.${id}`;
}
