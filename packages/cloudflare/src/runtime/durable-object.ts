import { DurableObject } from "cloudflare:workers";
import type { IRGraph } from "@kalphq/sdk";

type RuntimeManifest = IRGraph;

/**
 * Durable Object shell for Kalp agent execution.
 * Runtime wiring is still intentionally thin, but manifest loading is now
 * dynamic from KV so `kalp push` can hot-reload without `wrangler deploy`.
 */
export class AgentDurableObject extends DurableObject {
  private currentAgentName: string | null = null;
  private currentManifestHash: string | null = null;
  private currentManifest: RuntimeManifest | null = null;

  private async getRuntimeManifest(agentName: string): Promise<{
    hash: string;
    manifest: RuntimeManifest;
  }> {
    const latestHash = await this.env.KALP_MANIFESTS.get(`${agentName}:latest`);
    if (!latestHash) {
      throw new Error(`No manifest pointer found for agent "${agentName}".`);
    }

    if (
      this.currentAgentName === agentName &&
      this.currentManifestHash === latestHash &&
      this.currentManifest
    ) {
      return { hash: latestHash, manifest: this.currentManifest };
    }

    const manifestRaw = await this.env.KALP_MANIFESTS.get(
      `${agentName}:${latestHash}:semantic-ir`,
    );

    if (!manifestRaw) {
      throw new Error(
        `Manifest "${agentName}:${latestHash}" not found in KALP_MANIFESTS.`,
      );
    }

    const manifest = JSON.parse(manifestRaw) as RuntimeManifest;

    this.currentAgentName = agentName;
    this.currentManifestHash = latestHash;
    this.currentManifest = manifest;

    return { hash: latestHash, manifest };
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    try {
      const url = new URL(request.url);
      const agentName = request.headers.get("x-kalp-agent-name") || "default";
      const { hash, manifest } = await this.getRuntimeManifest(agentName);

      const eventType =
        url.pathname === "/" || url.pathname === ""
          ? "onMessage"
          : `route:${request.method.toUpperCase()}:${url.pathname}`;
      const payload =
        request.method.toUpperCase() === "GET"
          ? Object.fromEntries(url.searchParams)
          : await request.json().catch(() => null);

      return Response.json({
        ok: true,
        result: {
          agentName,
          manifestHash: hash,
          eventType,
          payload,
          entries: Object.keys(manifest.nodes || {}),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }

  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    try {
      const payload = JSON.parse(message);
      ws.send(JSON.stringify({ ok: true, payload }));
    } catch (err) {
      ws.send(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
