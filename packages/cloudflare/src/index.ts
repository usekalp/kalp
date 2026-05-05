/**
 * @kalphq/cloudflare — Cloudflare Workers + Durable Objects adapter.
 *
 * This package provides the Cloudflare-specific runtime binding for the
 * Kalp orchestration engine. It contains:
 * - DO-backed persistence, scheduler, and transport adapters
 * - AgentDurableObject lifecycle shell
 * - Worker fetch entrypoint (dumb router)
 * - Platform wiring (adapter creation → core factory)
 *
 * @module
 */

// Runtime
export { AgentDurableObject } from "./runtime/durable-object";

// Wiring
export { wireReactor } from "./wiring";

// DO Adapters
export {
  DurableObjectPersistence,
  DurableObjectScheduler,
  DurableObjectTransport,
  DOStateStore,
  DOEventStore,
  DOIdempotencyStore,
  DOThreadStore,
} from "./adapters/durable-object";

// Worker entrypoint (default export for wrangler)
export { default } from "./runtime/worker";
