/**
 * @kalphq/core — Kalp v2 Orchestration Runtime
 *
 * This is the Durable Object entry point. The DO is a thin shell:
 * - Receives HTTP/WebSocket events from the Worker entrypoint
 * - Creates adapter instances (persistence, scheduler, transport)
 * - Delegates all orchestration logic to the {@link OrchestrationReactor}
 *
 * @module
 */

import { DurableObject } from "cloudflare:workers";
import type { IRGraph } from "@kalphq/sdk";
import { OrchestrationReactor } from "@/engine/reactor";
import type { HandlerModule, RuntimeEvent } from "@/engine/types";
import type { RuntimeProviders } from "@/engine/context-builder";
import {
  DurableObjectPersistence,
  DurableObjectScheduler,
  DurableObjectTransport,
} from "@/adapters/durable-object";

// ────────────────────────────────────────────────────────────────────────────
// Re-exports for external consumers
// ────────────────────────────────────────────────────────────────────────────

export { OrchestrationReactor } from "@/engine/reactor";
export { ExecutionLog } from "@/engine/execution-log";
export type {
  ExecutionEvent,
  ExecutionContext,
  UntrackedIOSource,
  RuntimeEvent,
  ExecutionTask,
  HandlerModule,
} from "@/engine/types";
export type {
  PersistenceAdapter,
  SchedulerAdapter,
  TransportAdapter,
  CrossThreadAdapter,
  StateStore,
  EventStore,
  IdempotencyStore,
  ThreadStore,
} from "@/adapters/interfaces";
export {
  InMemoryPersistence,
  InMemoryScheduler,
  InMemoryTransport,
  InMemoryCrossThread,
} from "@/adapters/in-memory";
export {
  DurableObjectPersistence,
  DurableObjectScheduler,
  DurableObjectTransport,
} from "@/adapters/durable-object";
export { buildHandlerContext } from "@/engine/context-builder";
export type { RuntimeProviders } from "@/engine/context-builder";

// ────────────────────────────────────────────────────────────────────────────
// Agent Durable Object
// ────────────────────────────────────────────────────────────────────────────

/**
 * Durable Object class for a deployed Kalp agent.
 *
 * Each agent instance lives in its own DO. The DO is responsible for:
 * 1. Bootstrapping adapter instances on first request.
 * 2. Routing incoming HTTP/WebSocket events to the reactor.
 * 3. Handling alarms (scheduled wake-ups from `actions.wait`).
 *
 * The DO does NOT contain any orchestration logic — that lives in
 * the {@link OrchestrationReactor}.
 */
export class AgentDurableObject extends DurableObject<Env> {
  /** The reactor instance, lazily created on first event. */
  private reactor: OrchestrationReactor | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Lazily initializes the reactor with the agent's IR and bundles.
   *
   * In production, the IR and handler bundles are loaded from storage
   * (written during `kalp push`). This method creates the adapter
   * instances and wires them to the reactor.
   *
   * @returns The initialized reactor.
   */
  private async getReactor(): Promise<OrchestrationReactor> {
    if (this.reactor) return this.reactor;

    // Load IR and bundles from DO storage (written by push endpoint)
    const irRaw = await this.ctx.storage.get<string>("__ir__");
    const bundleMapRaw =
      await this.ctx.storage.get<Record<string, string>>("__bundles__");

    if (!irRaw) {
      throw new Error("Agent not deployed: IR not found in storage.");
    }

    const ir = JSON.parse(irRaw) as IRGraph;
    const bundles = new Map<string, HandlerModule>();

    // Load handler modules from stored code strings
    if (bundleMapRaw) {
      for (const [moduleRef, code] of Object.entries(bundleMapRaw)) {
        // Create a module from the stored code string
        // In production, these are pre-bundled ESM modules
        const blob = new Blob([code], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        try {
          const mod = (await import(url)) as HandlerModule;
          bundles.set(moduleRef, mod);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    }

    // Create adapters
    const persistence = new DurableObjectPersistence(this.ctx.storage);
    persistence.ensureReady();
    const scheduler = new DurableObjectScheduler(this.ctx.storage);

    // Stub providers — real implementations will be injected per-request
    const providers: RuntimeProviders = {
      ai: {
        generate: async () => "" as any,
        stream: () =>
          (async function* () {
            yield "" as any;
          })() as any,
        classify: async () => "",
      },
      auth: { userId: "" as any, claims: {}, hasPermission: () => false },
      memory: {
        list: async () => ({ items: [] }),
        append: async () => {},
        summarize: async () => "",
      },
      vault: { get: async () => "" },
    };

    this.reactor = new OrchestrationReactor(
      ir,
      bundles,
      persistence,
      scheduler,
      providers,
    );
    return this.reactor;
  }

  /**
   * Handles incoming HTTP requests and WebSocket upgrades.
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");

    // WebSocket upgrade
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server as WebSocket);
      return new Response(null, {
        status: 101,
        webSocket: client as WebSocket,
      });
    }

    // HTTP event dispatch
    try {
      const reactor = await this.getReactor();
      const url = new URL(request.url);
      const method = request.method.toUpperCase();

      // Determine event type from URL path and method
      const eventType =
        url.pathname === "/" || url.pathname === ""
          ? "onMessage"
          : `route:${method}:${url.pathname}`;

      const payload =
        request.method === "GET"
          ? Object.fromEntries(url.searchParams)
          : await request.json().catch(() => null);

      const event: RuntimeEvent = {
        type: eventType,
        payload,
        threadId: this.ctx.id.toString(),
      };
      const result = await reactor.handleEvent(event);

      return Response.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }

  /**
   * Handles WebSocket messages by dispatching "onMessage" events.
   */
  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    try {
      const reactor = await this.getReactor();
      const payload = JSON.parse(message);
      const result = await reactor.handleEvent({
        type: "onMessage",
        payload,
        threadId: this.ctx.id.toString(),
      });

      // Broadcast result to all connected clients
      const transport = new DurableObjectTransport(this.ctx, ws);
      await transport.send(result);
    } catch (err) {
      ws.send(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  /**
   * Handles alarm wake-ups from scheduled `actions.wait` calls.
   */
  async alarm(): Promise<void> {
    const reactor = await this.getReactor();
    await reactor.handleEvent({
      type: "onTick",
      payload: { reason: "alarm" },
      threadId: this.ctx.id.toString(),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Worker Entrypoint
// ────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    // Agent name is the first path segment (e.g. /myAgent/...)
    const segments = url.pathname.split("/").filter(Boolean);
    const agentName = segments[0] || "default";

    const id = env.MY_DURABLE_OBJECT.idFromName(agentName);
    const stub = env.MY_DURABLE_OBJECT.get(id);

    const response = await stub.fetch(request);

    // WebSocket upgrades pass through directly
    if (response.status === 101) return response;

    // Inject CORS headers for HTTP responses
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
} satisfies ExportedHandler<Env>;
