import type { RuntimeEvent } from "./runtime-events";

export class EventBus {
  private handlers = new Map<RuntimeEvent["type"], Set<(event: RuntimeEvent) => void>>();

  emit(event: RuntimeEvent): void {
    const set = this.handlers.get(event.type);
    if (!set) return;
    for (const handler of set) handler(event);
  }

  on<T extends RuntimeEvent["type"]>(
    type: T,
    handler: (event: Extract<RuntimeEvent, { type: T }>) => void,
  ): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler as (event: RuntimeEvent) => void);
  }

  off<T extends RuntimeEvent["type"]>(
    type: T,
    handler: (event: Extract<RuntimeEvent, { type: T }>) => void,
  ): void {
    this.handlers.get(type)?.delete(handler as (event: RuntimeEvent) => void);
  }
}
