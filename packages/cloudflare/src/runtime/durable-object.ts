import { DurableObject } from "cloudflare:workers";
import { type IRGraph, type KalpAI, asUserId } from "@kalphq/sdk";
import type { HandlerModule, RuntimeEvent } from "@kalphq/core";
import type { RuntimeProviders } from "@kalphq/core";
import type { OrchestrationReactor } from "@kalphq/core";
import { wireReactor } from "../wiring";
import { DurableObjectTransport } from "../adapters/durable-object";

/**
 * Durable Object class for a deployed Kalp agent.
 *
 * Each agent instance lives in its own DO. The DO is responsible for:
 * 1. Bootstrapping adapter instances on first request via {@link wireReactor}.
 * 2. Routing incoming HTTP/WebSocket events to the reactor.
 * 3. Handling alarms (scheduled wake-ups from `actions.wait`).
 *
 * The DO does NOT contain any orchestration logic — that lives in
 * the {@link OrchestrationReactor}.
 */
export class AgentDurableObject extends DurableObject<Env> {
  /** The reactor instance, lazily created on first event. */
  private reactor: OrchestrationReactor | null = null;

  /**
   * Lazily initializes the reactor with the agent's IR and bundles.
   *
   * In production, the IR and handler bundles are loaded from storage
   * (written during `kalp push`). This method delegates adapter creation
   * to {@link wireReactor}.
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

    // Stub providers — real implementations will be injected per-request
    const stubAI: KalpAI = {
      generate: async () => "" as never,
      stream: () =>
        (async function* () {
          /* noop */
        })() as never,
      classify: async () => "" as never,
    };

    const providers: RuntimeProviders = {
      ai: stubAI,
      auth: {
        userId: asUserId(""),
        providerId: "anonymous",
        claims: {},
        hasPermission: () => false,
      },
      memory: {
        list: async () => ({ items: [] }),
        append: async () => {},
        summarize: async () => "",
      },
      vault: { get: async () => "" },
    };

    this.reactor = wireReactor(this.ctx.storage, ir, bundles, providers);
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
