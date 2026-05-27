import { Agent } from "agents";
import type {
  IRGraph,
  BundleManifest,
  BundleNodeBinding,
  SchemaRegistry,
  NodeDescriptor,
} from "@kalphq/sdk";
import type { CloudflareAIConfig, McpServerRuntimeConfig } from "@kalphq/sdk";
import type { RuntimeEventType } from "@kalphq/core";
import { wireRuntime } from "@/wiring";
import { AgentPersistence } from "@/persistence";

export interface AgentRuntimeContext {
  hash: string;
  ir: IRGraph;
  schemas: SchemaRegistry;
  bundleManifest: BundleManifest;
}

type AgentState = {
  loaded: boolean;
  hash: string | null;
};

export class KalpAgent extends Agent<Env, AgentState> {
  override initialState: AgentState = { loaded: false, hash: null };

  private currentAgentName: string | null = null;
  private currentManifestHash: string | null = null;
  private currentAgentCtx: AgentRuntimeContext | null = null;
  private mcpConfig: Record<string, McpServerRuntimeConfig> | undefined;
  private schemaReady = false;

  private aiConfig: CloudflareAIConfig | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    try {
      const envRecord = env as unknown as Record<string, unknown>;

      const mcpRaw = envRecord.KALP_MCP_CONFIG as string | undefined;
      if (mcpRaw) this.mcpConfig = JSON.parse(mcpRaw);

      const aiRaw = envRecord.KALP_AI_CONFIG as string | undefined;
      if (aiRaw) this.aiConfig = JSON.parse(aiRaw);
    } catch {
      this.mcpConfig = undefined;
      this.aiConfig = undefined;
    }
  }

  override async onStart() {
    this.ensureSchema();
  }

  private ensureSchema(): void {
    if (this.schemaReady) return;
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, thread_id TEXT, trace_id TEXT, execution_id TEXT, payload TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000))",
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)",
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS thread_meta (thread_id TEXT PRIMARY KEY, meta TEXT NOT NULL)",
    );
    this.schemaReady = true;
  }

  override async onRequest(request: Request): Promise<Response> {
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

      const kvStorage = this.env as unknown as {
        get(key: string): Promise<string | null>;
      };
      const mcpConfig = await this.loadMcpConfig(kvStorage);

      const envRecord = this.env as unknown as Record<string, unknown>;
      const cfApiToken = envRecord.CLOUDFLARE_API_TOKEN as string | undefined;
      const cfAccountId = envRecord.CLOUDFLARE_ACCOUNT_ID as string | undefined;

      const persistence = new AgentPersistence(this.ctx.storage.sql);
      persistence.ensureReady();

      const runtime = wireRuntime(
        persistence,
        ctx.ir,
        ctx.schemas,
        ctx.bundleManifest,
        bundleLoader,
        {
          ai: this.aiConfig,
          mcp: mcpConfig,
          cloudflareApiToken: cfApiToken,
          cloudflareAccountId: cfAccountId,
        },
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

  private async loadMcpConfig(storage: {
    get(key: string): Promise<string | null>;
  }): Promise<Record<string, McpServerRuntimeConfig> | undefined> {
    if (this.mcpConfig !== undefined) {
      return Object.keys(this.mcpConfig).length > 0
        ? this.mcpConfig
        : undefined;
    }

    try {
      const raw = await storage.get("mcp:config");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<
          string,
          McpServerRuntimeConfig
        >;
        this.mcpConfig = parsed;
        return Object.keys(parsed).length > 0 ? parsed : undefined;
      }
    } catch {
      // MCP config not available
    }
    return undefined;
  }

  private async resolveAgentContext(
    agentName: string,
  ): Promise<AgentRuntimeContext> {
    const kvStorage = this.env as unknown as {
      get(key: string): Promise<string | null>;
    };

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
      throw new Error(
        `Bundle manifest not found for ${agentName}:${latestHash}.`,
      );
    }

    const ir = JSON.parse(irRaw) as IRGraph;
    const schemas = schemasRaw
      ? (JSON.parse(schemasRaw) as SchemaRegistry)
      : {};
    const bundleManifest = JSON.parse(bundleManifestRaw) as BundleManifest;

    const agentCtx: AgentRuntimeContext = {
      hash: latestHash,
      ir,
      schemas,
      bundleManifest,
    };

    this.currentAgentName = agentName;
    this.currentManifestHash = latestHash;
    this.currentAgentCtx = agentCtx;

    return agentCtx;
  }

  private createBundleLoader(agentName: string, hash: string) {
    const kvStorage = this.env as unknown as {
      get(key: string): Promise<string | null>;
    };
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
  ): RuntimeEventType {
    const method = request.method.toUpperCase();
    const nodes = Object.values(ir.nodes ?? {}) as NodeDescriptor[];

    if (pathname === "/" || pathname === "") {
      const hasMessage = nodes.some((node) => node.kind === "message");
      return hasMessage ? "onMessage" : "route:default";
    }

    const routeKey = `${method}:${pathname}`;

    const matched = nodes.find((node) => {
      if (node.kind !== "route") return false;
      const httpTrigger = node.trigger?.type === "http" ? node.trigger : null;
      const nodeMethod = node.http?.method ?? httpTrigger?.method ?? "GET";
      const nodePath = node.http?.path ?? httpTrigger?.path ?? "/";
      return `${nodeMethod}:${nodePath}` === routeKey;
    });

    if (matched) {
      return `route:${matched.stableName ?? matched.id}` as RuntimeEventType;
    }

    return `route:${method}:${pathname}` as RuntimeEventType;
  }
}
