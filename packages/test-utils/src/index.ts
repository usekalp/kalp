/**
 * @kalphq/test-utils — Deterministic fake adapters for testing.
 *
 * Provides in-memory implementations of all core adapter interfaces.
 * Designed for unit tests, local dev, and integration testing without
 * infrastructure dependencies.
 *
 * @module
 */

// Sub-stores
export {
  InMemoryStateStore,
  InMemoryEventStore,
  InMemoryIdempotencyStore,
  InMemoryThreadStore,
} from "./in-memory";

// Composite adapters
export {
  InMemoryPersistence,
  InMemoryScheduler,
  InMemoryTransport,
  InMemoryCrossThread,
} from "./in-memory";
