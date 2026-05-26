import type {
  StateStore,
} from "@kalphq/core";

export class AgentStateStore implements StateStore {
  constructor(private sql: SqlStorage) {}

  async get(key: string): Promise<unknown> {
    const cursor = this.sql.exec("SELECT value FROM state WHERE key = ?", key);
    const row = cursor.next().value;
    if (!row) return null;
    return JSON.parse(String(row.value));
  }

  async set(key: string, value: unknown): Promise<void> {
    this.sql.exec(
      "INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)",
      key,
      JSON.stringify(value),
    );
  }

  async delete(key: string): Promise<void> {
    this.sql.exec("DELETE FROM state WHERE key = ?", key);
  }

  async increment(key: string, amount: number): Promise<number> {
    const current = (await this.get(key)) as number | null;
    const next = (current ?? 0) + amount;
    await this.set(key, next);
    return next;
  }

  async list(prefix?: string): Promise<string[]> {
    const cursor = this.sql.exec(
      prefix
        ? "SELECT key FROM state WHERE key LIKE ?"
        : "SELECT key FROM state",
      prefix ? `${prefix}%` : undefined,
    );
    const keys: string[] = [];
    for (const row of cursor) {
      keys.push(String(row.key));
    }
    return keys;
  }

  async batch(
    operations: Array<
      | { op: "put"; key: string; value: unknown }
      | { op: "delete"; key: string }
      | { op: "increment"; key: string; amount: number }
      | { op: "cas"; key: string; expected: unknown; next: unknown }
    >,
  ): Promise<void> {
    this.sql.exec("BEGIN TRANSACTION");
    try {
      for (const op of operations) {
        switch (op.op) {
          case "put":
            await this.set(op.key, op.value);
            break;
          case "delete":
            await this.delete(op.key);
            break;
          case "increment":
            await this.increment(op.key, op.amount);
            break;
          case "cas": {
            const current = await this.get(op.key);
            if (current === op.expected) {
              await this.set(op.key, op.next);
            }
            break;
          }
        }
      }
      this.sql.exec("COMMIT");
    } catch (e) {
      this.sql.exec("ROLLBACK");
      throw e;
    }
  }
}