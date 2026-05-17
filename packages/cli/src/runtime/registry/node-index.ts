import type { NodeIndexEntry } from "./types";

export class NodeIndex {
  private index = new Map<string, NodeIndexEntry>();

  set(nodeId: string, entry: NodeIndexEntry): void {
    this.index.set(nodeId, entry);
  }

  get(nodeId: string): NodeIndexEntry | undefined {
    return this.index.get(nodeId);
  }

  delete(nodeId: string): void {
    this.index.delete(nodeId);
  }

  removeAgentNodes(agentName: string): void {
    for (const [nodeId, entry] of this.index) {
      if (entry.agentName === agentName) {
        this.index.delete(nodeId);
      }
    }
  }

  clear(): void {
    this.index.clear();
  }
}
