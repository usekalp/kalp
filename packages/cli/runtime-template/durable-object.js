import { DurableObject } from "cloudflare:workers";
import { readSemanticIr } from "./storage.js";
import { normalizeHeaderRecord } from "./shared.js";

function deriveEventType(method, pathname, manifest) {
  const nodes = Object.values(manifest?.nodes ?? {});
  if (pathname === "/" || pathname === "") {
    const hasMessage = nodes.some((node) => node.kind === "message");
    return hasMessage ? "message" : "invoke";
  }

  const matchedRoute = nodes.find(
    (node) =>
      node.kind === "route" &&
      (node.http?.method ?? node.trigger?.method ?? "GET").toUpperCase() ===
        method.toUpperCase() &&
      (node.http?.path ?? node.trigger?.path ?? "/") === pathname,
  );
  if (matchedRoute) {
    return `route:${matchedRoute.stableName ?? matchedRoute.id}`;
  }
  return `http:${method.toUpperCase()}:${pathname}`;
}

function deriveMessageText(payload) {
  if (payload && typeof payload === "object" && typeof payload.message === "string") {
    return payload.message;
  }
  return "Runtime invocation completed.";
}

export class AgentDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    /** @type {Record<string, { url: string; headers?: Record<string, string> }>|null} */
    this._mcpConfig = null;
  }

  /** @returns {Record<string, { url: string; headers?: Record<string, string> }>} */
  getMcpConfig() {
    if (!this._mcpConfig) {
      try {
        this._mcpConfig = this.env.KALP_MCP_CONFIG
          ? JSON.parse(this.env.KALP_MCP_CONFIG)
          : {};
      } catch {
        this._mcpConfig = {};
      }
    }
    return this._mcpConfig;
  }

  async getRuntimeManifest(agentName) {
    // SIEMPRE via registry binding — NO cache local
    const res = await this.env.KALP_REGISTRY.fetch(
      "http://registry/resolve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentName }),
      }
    );

    if (!res.ok) {
      throw new Error(`No manifest pointer found for agent "${agentName}".`);
    }

    const { deploymentHash, routingTable, capabilities } = await res.json();

    // Fetch full semantic IR from KV (persistence layer only)
    const semanticIr = await readSemanticIr(this.env, agentName);
    if (!semanticIr) {
      throw new Error(`No semantic IR found for agent "${agentName}".`);
    }

    return {
      hash: deploymentHash,
      semanticIr: semanticIr.semanticIr,
      routingTable,
      capabilities,
    };
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    const url = new URL(request.url);
    const agentName = request.headers.get("x-kalp-agent-name") || "default";

    // Fresh lookup via registry binding — no cache
    const { hash, semanticIr, routingTable, capabilities } = await this.getRuntimeManifest(agentName);
    const payload = request.method.toUpperCase() === "GET"
      ? Object.fromEntries(url.searchParams)
      : await request.json().catch(() => null);

    const text = deriveMessageText(payload);

    return Response.json({
      ok: true,
      text,
      result: {
        agentName,
        manifestHash: hash,
        eventType: deriveEventType(request.method, url.pathname, semanticIr),
        payload,
        auth: normalizeHeaderRecord(request),
        entries: Object.keys(semanticIr.nodes || {}),
      },
    });
  }
}
