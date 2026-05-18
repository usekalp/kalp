import { DurableObject } from "cloudflare:workers";
import type { IRGraph, BundleManifest, BundleNodeBinding, SchemaRegistry } from "@kalphq/sdk";
import type { McpServerRuntimeConfig } from "@kalphq/sdk";
import { wireRuntime } from "../wiring";

type KVStorage = {
  get(key: string): Promise<string | null>;
};

export interface AgentRuntimeContext {
  hash: string;
  ir: IRGraph;
  schemas: SchemaRegistry;
  bundleManifest: BundleManifest;
}

export class AgentDurableObject extends DurableObject {
  private currentAgentName: string | null = null;
  private currentManifestHash: string | null = null;
  private currentAgentCtx: AgentRuntimeContext | null = null;
  private mcpConfig: Record<string, McpServerRuntimeConfig> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    try {
      const envRecord = env as unknown as Record<string, unknown>;
      const raw = envRecord.KALP_MCP_CONFIG as string | undefined;
      if (raw) {
        this.mcpConfig = JSON.parse(raw);
      }
    } catch {
      this.mcpConfig = undefined;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    try {
      const url = new URL(request.url);
      const agentName = request.headers.get("x-kalp-agent-name") || "default";

      const ctx = await this.resolveAgentContext(agentName);
      const bundleLoader = this.createBundleLoader(agentName, ctx.hash);

      const kvStorage = this.env as unknown as KVStorage;
      const mcpConfig = await this.loadMcpConfig(kvStorage);

      const runtime = wireRuntime(
        this.ctx.storage,
        ctx.ir,
        ctx.schemas,
        ctx.bundleManifest,
        bundleLoader,
        { mcp: mcpConfig },
      );

      const eventType = this.deriveEventType(request, url.pathname, ctx.ir);
      const payload =
        request.method.toUpperCase() === "GET"
          ? Object.fromEntries(url.searchParams)
          : await request.json().catch(() => null);

      const result = await runtime.handleEvent({
        type: eventType,
        payload,
        threadId: request.headers.get("x-kalp-thread-id") || undefined,
        traceId: request.headers.get("x-kalp-trace-id") || undefined,
      });

      return Response.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }

  private async loadMcpConfig(storage: KVStorage): Promise<Record<string, McpServerRuntimeConfig> | undefined> {
    if (this.mcpConfig !== undefined) {
      return Object.keys(this.mcpConfig).length > 0 ? this.mcpConfig : undefined;
    }

    try {
      const raw = await storage.get("mcp:config");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, McpServerRuntimeConfig>;
        this.mcpConfig = parsed;
        return Object.keys(parsed).length > 0 ? parsed : undefined;
      }
    } catch {
      // MCP config not available
    }
    return undefined;
  }

  private async resolveAgentContext(agentName: string): Promise<AgentRuntimeContext> {
    const kvStorage = this.env as unknown as KVStorage;

    const latestHash = await kvStorage.get(`${agentName}:latest`);
    if (!latestHash) {
      throw new Error(`No manifest found for agent "${agentName}".`);
    }

    if (
      this.currentAgentName === agentName &&
      this.currentManifestHash === latestHash &&
      this.currentAgentCtx
    ) {
      return this.currentAgentCtx;
    }

    const payloads = await Promise.all([
      kvStorage.get(`${agentName}:${latestHash}:semantic-ir`),
      kvStorage.get(`${agentName}:${latestHash}:schemas`),
      kvStorage.get(`${agentName}:${latestHash}:bundle-manifest`),
    ]);

    const [irRaw, schemasRaw, bundleManifestRaw] = payloads;

    if (!irRaw) {
      throw new Error(`Semantic IR not found for ${agentName}:${latestHash}.`);
    }
    if (!bundleManifestRaw) {
      throw new Error(`Bundle manifest not found for ${agentName}:${latestHash}.`);
    }

    const ir = JSON.parse(irRaw) as IRGraph;
    const schemas = schemasRaw ? JSON.parse(schemasRaw) as SchemaRegistry : {};
    const bundleManifest = JSON.parse(bundleManifestRaw) as BundleManifest;

    const ctx: AgentRuntimeContext = { hash: latestHash, ir, schemas, bundleManifest };

    this.currentAgentName = agentName;
    this.currentManifestHash = latestHash;
    this.currentAgentCtx = ctx;

    return ctx;
  }

  private createBundleLoader(agentName: string, hash: string) {
    const kvStorage = this.env as unknown as KVStorage;
    return async (binding: BundleNodeBinding): Promise<string> => {
      const key = `${agentName}:${hash}:bundle:${binding.sha256}`;
      const raw = await kvStorage.get(key);
      if (!raw) {
        throw new Error(
          `Bundle ${binding.sha256} not found for ${agentName}:${hash}.`,
        );
      }
      return raw;
    };
  }

  private deriveEventType(
    request: Request,
    pathname: string,
    ir: IRGraph,
  ): any {
    const method = request.method.toUpperCase();
    const nodes = Object.values(ir.nodes ?? {});

    if (pathname === "/" || pathname === "") {
      const hasMessage = nodes.some((node: any) => node.kind === "message");
      return hasMessage ? "onMessage" : "invoke";
    }

    const routeKey = `${method}:${pathname}`;
    const matched = nodes.find(
      (node: any) =>
        node.kind === "route" &&
        `${(node as any).http?.method ?? (node as any).trigger?.method ?? "GET"}:${(node as any).http?.path ?? (node as any).trigger?.path ?? "/"}` === routeKey,
    );
    if (matched) {
      return `route:${(matched as any).stableName ?? (matched as any).id}`;
    }

    return `http:${method}:${pathname}`;
  }
}
