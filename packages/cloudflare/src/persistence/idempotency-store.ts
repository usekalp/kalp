import type { IdempotencyStore } from "@kalphq/core";

export class AgentIdempotencyStore implements IdempotencyStore {
  constructor(private sql: SqlStorage) {}

  async get(key: string): Promise<unknown | null> {
    const cursor = this.sql.exec(
      "SELECT value, expires_at FROM idempotency WHERE key = ?",
      key,
    );
    const row = cursor.next().value;
    if (!row) return null;
    const expiresAt = row.expires_at as number | null;
    if (expiresAt && Date.now() > expiresAt) {
      this.sql.exec("DELETE FROM idempotency WHERE key = ?", key);
      return null;
    }
    return JSON.parse(String(row.value));
  }

  async set(
    key: string,
    result: unknown,
    opts?: { ttlMs?: number },
  ): Promise<void> {
    const expiresAt = opts?.ttlMs ? Date.now() + opts.ttlMs : null;
    this.sql.exec(
      "INSERT OR REPLACE INTO idempotency (key, value, expires_at) VALUES (?, ?, ?)",
      key,
      JSON.stringify(result),
      expiresAt,
    );
  }
}