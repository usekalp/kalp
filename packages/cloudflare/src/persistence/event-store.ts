import type { EventStore } from "@kalphq/core";
import type { ExecutionEvent, PersistedEffect } from "@kalphq/core";

export class AgentEventStore implements EventStore {
  constructor(private sql: SqlStorage) {}

  async append(event: ExecutionEvent | PersistedEffect): Promise<void> {
    const threadId = "threadId" in event ? event.threadId : null;
    const traceId = "traceId" in event ? event.traceId : null;
    const executionId = "executionId" in event ? event.executionId : null;
    this.sql.exec(
      "INSERT INTO events (type, thread_id, trace_id, execution_id, payload) VALUES (?, ?, ?, ?, ?)",
      event.type,
      threadId,
      traceId,
      executionId,
      JSON.stringify(event),
    );
  }

  async loadAll(): Promise<ExecutionEvent[]> {
    const cursor = this.sql.exec(
      "SELECT payload FROM events ORDER BY id ASC",
    );
    const events: ExecutionEvent[] = [];
    for (const row of cursor) {
      events.push(JSON.parse(String(row.payload)) as ExecutionEvent);
    }
    return events;
  }

  async loadByThread(threadId: string): Promise<ExecutionEvent[]> {
    const cursor = this.sql.exec(
      "SELECT payload FROM events WHERE thread_id = ? ORDER BY id ASC",
      threadId,
    );
    const events: ExecutionEvent[] = [];
    for (const row of cursor) {
      events.push(JSON.parse(String(row.payload)) as ExecutionEvent);
    }
    return events;
  }

  async loadByTrace(traceId: string): Promise<ExecutionEvent[]> {
    const cursor = this.sql.exec(
      "SELECT payload FROM events WHERE trace_id = ? ORDER BY id ASC",
      traceId,
    );
    const events: ExecutionEvent[] = [];
    for (const row of cursor) {
      events.push(JSON.parse(String(row.payload)) as ExecutionEvent);
    }
    return events;
  }
}