/**
 * Vault primitive for the Kalp Proxy-Listener Runtime.
 *
 * Wraps the vault provider with event logging for durability.
 * This primitive manages secrets with deterministic replay support.
 * The SDK KalpVault interface only has a get method.
 *
 * @module
 */

import type { KalpVault, SecretKey, RegisteredSecrets } from "@kalphq/sdk";
import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates a vault primitive with event logging.
 *
 * @param vaultProvider - The underlying vault provider implementation.
 * @param eventStore - The event store for persistence.
 * @param execCtx - The execution context for event identity.
 * @returns A vault primitive matching the KalpVault interface.
 */
export function createVaultPrimitive(
  vaultProvider: KalpVault,
  eventStore: EventStore,
  execCtx: ExecutionContext,
): KalpVault {
  // Get sequence counter reference for intent events
  const getNextSeq = () => ++execCtx.seqCounter;

  const ids = {
    executionId: execCtx.executionId,
    traceId: execCtx.traceId,
    threadId: execCtx.threadId,
  };

  return {
    async get(key: SecretKey<RegisteredSecrets>): Promise<string> {
      const value = await vaultProvider.get(key);

      // Log vault read (key only, not the secret value)
      void eventStore.append({
        seq: getNextSeq(),
        type: "intent.vault_read",
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
        payload: { key: String(key), found: value !== undefined },
      });

      return value;
    },
  };
}
