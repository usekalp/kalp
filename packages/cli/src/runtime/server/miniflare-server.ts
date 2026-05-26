import { Miniflare } from "miniflare";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import type { RuntimeRegistry } from "../registry/runtime-registry";
import { ServiceBindings } from "./service-bindings";
import { GracefulDrain } from "./graceful-drain";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

function createAssetBinding(studioDir: string) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    let pathname = url.pathname;
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const filePath = join(studioDir, pathname);

    try {
      await stat(filePath);
    } catch {
      return new Response("Not found", { status: 404 });
    }

    const content = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    return new Response(content as unknown as BodyInit, {
      headers: { "content-type": contentType },
    });
  };
}

export interface MiniflareServerOptions {
  registry: RuntimeRegistry;
  scriptPath: string;
  studioDir: string;
  port: number;
  bindings?: Record<string, string>;
}

export class MiniflareServer {
  private mf: Miniflare | null = null;
  private registry: RuntimeRegistry;
  private scriptPath: string;
  private studioDir: string;
  private port: number;
  private bindings: Record<string, string>;
  private drain: GracefulDrain;

  constructor(options: MiniflareServerOptions) {
    this.registry = options.registry;
    this.scriptPath = options.scriptPath;
    this.studioDir = options.studioDir;
    this.port = options.port;
    this.bindings = options.bindings ?? {};
    this.drain = new GracefulDrain({ timeoutMs: 10_000 });
  }

  async start(): Promise<void> {
    this.drain.reset();

    this.mf = new Miniflare({
      modules: true,
      modulesRules: [
        { type: "Text", include: ["**/*.json"], fallthrough: true },
      ],
      scriptPath: this.scriptPath,
      compatibilityDate: "2026-05-10",
      compatibilityFlags: ["nodejs_compat"],
      kvNamespaces: { KALP_MANIFESTS: "kalp-manifests" },
      durableObjects: { KALP_RUNTIME_CLOUDFLARE: "KalpAgent" },
      bindings: this.bindings,
      serviceBindings: {
        ...ServiceBindings.create(this.registry, this.drain),
        ASSETS: createAssetBinding(this.studioDir),
      },
      port: this.port,
      liveReload: true,
    });

    await this.mf.ready;
  }

  async stop(): Promise<void> {
    if (this.mf) {
      // Timeout dispose — workerd can hang on socket close on Windows
      const disposePromise = this.mf.dispose();
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(resolve, 5000);
      });
      await Promise.race([disposePromise, timeoutPromise]);
      this.mf = null;
    }
  }

  async restart(options?: {
    scriptPath?: string;
    bindings?: Record<string, string>;
  }): Promise<void> {
    if (options?.scriptPath) this.scriptPath = options.scriptPath;
    if (options?.bindings) this.bindings = options.bindings;

    await this.drain.drain(() => this.stop());
    // Allow OS to release the port on Windows
    await new Promise(r => setTimeout(r, 500));
    await this.start();
  }

  async getKVNamespace(): Promise<ReturnType<typeof import("miniflare").Miniflare.prototype.getKVNamespace>> {
    if (!this.mf) throw new Error("Miniflare not started");
    return this.mf.getKVNamespace("KALP_MANIFESTS");
  }

  get url(): string {
    return `http://localhost:${this.port}`;
  }
}
