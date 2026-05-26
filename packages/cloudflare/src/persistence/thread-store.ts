import type { ThreadStore } from "@kalphq/core";

export class AgentThreadStore implements ThreadStore {
  constructor(private sql: SqlStorage) {}

  async getMeta(threadId: string): Promise<Record<string, unknown> | null> {
    const cursor = this.sql.exec(
      "SELECT meta FROM thread_meta WHERE thread_id = ?",
      threadId,
    );
    const row = cursor.next().value;
    if (!row) return null;
    return JSON.parse(String(row.meta));
  }

  async setMeta(
    threadId: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    this.sql.exec(
      "INSERT OR REPLACE INTO thread_meta (thread_id, meta) VALUES (?, ?)",
      threadId,
      JSON.stringify(meta),
    );
  }
}