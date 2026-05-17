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
    this.currentAgentName = null;
    this.currentManifestHash = null;
    this.currentManifest = null;
  }

  async getRuntimeManifest(agentName) {
    const current = await readSemanticIr(this.env, agentName);
    if (!current) {
      throw new Error(`No manifest pointer found for agent "${agentName}".`);
    }

    if (
      this.currentAgentName === agentName &&
      this.currentManifestHash === current.hash &&
      this.currentManifest
    ) {
      return { hash: current.hash, manifest: this.currentManifest };
    }

    this.currentAgentName = agentName;
    this.currentManifestHash = current.hash;
    this.currentManifest = current.semanticIr;
    return { hash: current.hash, manifest: current.semanticIr };
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    const url = new URL(request.url);
    const agentName = request.headers.get("x-kalp-agent-name") || "default";
    const { hash, manifest } = await this.getRuntimeManifest(agentName);
    const payload =
      request.method.toUpperCase() === "GET"
        ? Object.fromEntries(url.searchParams)
        : await request.json().catch(() => null);

    const text = deriveMessageText(payload);

    return Response.json({
      ok: true,
      text,
      result: {
        agentName,
        manifestHash: hash,
        eventType: deriveEventType(request.method, url.pathname, manifest),
        payload,
        auth: normalizeHeaderRecord(request),
        entries: Object.keys(manifest.nodes || {}),
      },
    });
  }
}
