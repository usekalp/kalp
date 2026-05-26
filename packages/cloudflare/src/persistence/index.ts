import type { PersistenceAdapter } from "@kalphq/core";
import { AgentStateStore } from "./state-store";
import { AgentEventStore } from "./event-store";
import { AgentIdempotencyStore } from "./idempotency-store";
import { AgentThreadStore } from "./thread-store";

export { AgentStateStore } from "./state-store";
export { AgentEventStore } from "./event-store";
export { AgentIdempotencyStore } from "./idempotency-store";
export { AgentThreadStore } from "./thread-store";

const SCHEMA_TABLES = [
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, thread_id TEXT, trace_id TEXT, execution_id TEXT, payload TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000))`,
  `CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS thread_meta (thread_id TEXT PRIMARY KEY, meta TEXT NOT NULL)`,
];

export function ensureSchema(sql: SqlStorage): void {
  for (const ddl of SCHEMA_TABLES) {
    sql.exec(ddl);
  }
}

export class AgentPersistence implements PersistenceAdapter {
  readonly state: AgentStateStore;
  readonly events: AgentEventStore;
  readonly idempotency: AgentIdempotencyStore;
  readonly threads: AgentThreadStore;
  private schemaReady = false;
  private sql: SqlStorage;

  constructor(sql: SqlStorage) {
    this.sql = sql;
    this.state = new AgentStateStore(sql);
    this.events = new AgentEventStore(sql);
    this.idempotency = new AgentIdempotencyStore(sql);
    this.threads = new AgentThreadStore(sql);
  }

  ensureReady(): void {
    if (this.schemaReady) return;
    ensureSchema(this.sql);
    this.schemaReady = true;
  }
}