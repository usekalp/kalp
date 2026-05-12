import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { AgentDurableObject } from "./durable-object";
import agentsSnapshot from "./agents.snapshot.json";

export { AgentDurableObject };

type StudioSession = {
  username: string;
};

type StudioAgent = {
  name: string;
  label?: string;
  tags?: string[];
  environment: "local" | "remote" | "both";
  status: "online" | "offline";
  hash: string | null;
  version: string | null;
  versionNumber: number | null;
  lastRemoteHash: string | null;
  lastLocalHash: string | null;
  workerUrl: string | null;
  localPath: string | null;
  updatedAt: string | null;
};

type StudioSnapshot = {
  generatedAt: string;
  projectPath: string;
  workerUrl: string | null;
  mode: "local" | "remote";
  agents: StudioAgent[];
};

type RuntimeBindings = Env & {
  KALP_SECRET_KEY?: string;
  KALP_STUDIO_PASSWORD?: string;
  KALP_STUDIO_ADMIN_USER?: string;
  KALP_ENFORCE_GLOBAL_AUTH?: string;
};

type RuntimeVariables = {
  session: StudioSession;
};

const SESSION_COOKIE_NAME = "kalp_studio_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const snapshot = agentsSnapshot as StudioSnapshot;
const LISTENERS_QUEUE_KEY = "listeners:queue";

type ManifestMetadata = {
  name?: string;
  label?: string;
  tags?: string[];
  public?: boolean;
  routesPublic?: Record<string, boolean | undefined>;
  listeners?: Array<{
    sourceAgentId: string;
    event: string;
    targetEntryKey: string;
  }>;
};

type RuntimeManifest = {
  metadata?: ManifestMetadata;
  entries?: Record<string, string>;
};

function withCors(response: Response): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function resolveStudioAssetPath(pathname: string): string {
  if (pathname === "/studio" || pathname === "/studio/") return "";
  const stripped = pathname.replace(/^\/studio\//, "");
  return stripped || "";
}

async function serveAsset(
  env: RuntimeBindings,
  assetPath: string,
  request: Request,
): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.hostname = "assets.local";
  assetUrl.pathname = assetPath ? `/${assetPath.replace(/^\/+/, "")}` : "/";
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function shouldTreatAsStaticAsset(assetPath: string): boolean {
  if (!assetPath) return false;
  if (assetPath.startsWith("assets/")) return true;
  if (assetPath === "favicon.ico") return true;
  if (assetPath === "manifest.json") return true;
  if (assetPath === "robots.txt") return true;
  return assetPath.includes(".");
}

async function readSession(c: any): Promise<StudioSession | null> {
  const secret = c.env.KALP_SECRET_KEY;
  if (!secret) return null;

  const username = await getSignedCookie(c, secret, SESSION_COOKIE_NAME);
  if (!username || typeof username !== "string") return null;
  return { username };
}

async function requireSession(c: any, next: () => Promise<void>) {
  const session = await readSession(c);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("session", session);
  return next();
}

async function readLatestManifest(
  env: RuntimeBindings,
  agentName: string,
): Promise<RuntimeManifest | null> {
  const latest = await env.KALP_MANIFESTS.get(`${agentName}:latest`);
  if (!latest) return null;
  const raw = await env.KALP_MANIFESTS.get(`${agentName}:${latest}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RuntimeManifest;
  } catch {
    return null;
  }
}

async function resolveAgentAccess(
  env: RuntimeBindings,
  agentName: string,
  routeKey: string,
): Promise<{ isPublic: boolean; metadata?: ManifestMetadata }> {
  const manifest = await readLatestManifest(env, agentName);
  const metadata = manifest?.metadata;
  const routePublic = metadata?.routesPublic?.[routeKey];
  const agentPublic = metadata?.public ?? false;
  const isPublic = routePublic !== undefined ? routePublic : agentPublic;
  return { isPublic, metadata };
}

async function verifyGatewayAuth(c: any): Promise<{ sub?: string } | null> {
  const enforce = c.env.KALP_ENFORCE_GLOBAL_AUTH !== "false";
  if (!enforce) return { sub: undefined };
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const secret = c.env.KALP_SECRET_KEY;
  if (!secret) return null;
  try {
    const encoded = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encoded);
    return { sub: typeof payload.sub === "string" ? payload.sub : undefined };
  } catch {
    return null;
  }
}

async function queueListenerDispatch(
  env: RuntimeBindings,
  sourceAgent: string,
  eventName: string,
  payload: unknown,
): Promise<void> {
  const currentRaw = await env.KALP_MANIFESTS.get(LISTENERS_QUEUE_KEY);
  const current = currentRaw ? (JSON.parse(currentRaw) as unknown[]) : [];
  const next = [
    ...current,
    {
      sourceAgent,
      eventName,
      payload,
      queuedAt: new Date().toISOString(),
    },
  ];
  await env.KALP_MANIFESTS.put(LISTENERS_QUEUE_KEY, JSON.stringify(next));
}

function parseEventEnvelope(
  request: Request,
): { eventName: string; payload: unknown } | null {
  const eventName = request.headers.get("x-kalp-event-name");
  if (!eventName) return null;
  return {
    eventName,
    payload: request.headers.get("x-kalp-event-payload")
      ? JSON.parse(request.headers.get("x-kalp-event-payload") as string)
      : null,
  };
}

function getAgentRouting(url: URL): {
  agentName: string;
  passthroughPath: string;
} {
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] === "a" && segments[1]) {
    return {
      agentName: segments[1],
      passthroughPath: `/${segments.slice(2).join("/")}`,
    };
  }

  return {
    agentName: segments[0] || "default",
    passthroughPath: `/${segments.slice(1).join("/")}`,
  };
}

function inferRuntimeMode(c: any): "local" | "remote" {
  const explicitEnv = c.env.KALP_ENV;
  if (explicitEnv === "remote") return "remote";
  if (explicitEnv === "local") return "local";

  const runtimeMode = c.env.KALP_RUNTIME_MODE;
  if (runtimeMode === "local") return "local";
  if (runtimeMode === "remote") return "remote";

  const hasKvBinding = !!c.env.KALP_MANIFESTS;

  const isWranglerLocal =
    runtimeMode === "local" ||
    new URL(c.req.url).hostname === "localhost" ||
    new URL(c.req.url).hostname === "127.0.0.1";

  if (hasKvBinding && !isWranglerLocal) {
    return "remote";
  }

  const host = new URL(c.req.url).hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "local";
  }
  if (host.endsWith(".workers.dev") || host.endsWith(".pages.dev")) {
    return "remote";
  }
  const cfMeta = c.req.raw && (c.req.raw as any).cf;
  return cfMeta ? "remote" : snapshot.mode;
}

async function forwardToAgentDO(
  c: any,
  request: Request,
  env: RuntimeBindings,
) {
  const url = new URL(request.url);
  const { agentName, passthroughPath } = getAgentRouting(url);
  const routeKey = `${request.method.toUpperCase()}:${passthroughPath === "/" ? "/" : passthroughPath}`;
  const access = await resolveAgentAccess(env, agentName, routeKey);
  if (!access.isPublic) {
    const identity = await verifyGatewayAuth(c);
    if (!identity) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }
  }

  const envelope = parseEventEnvelope(request);
  if (envelope && typeof c.executionCtx?.waitUntil === "function") {
    c.executionCtx.waitUntil(
      queueListenerDispatch(
        env,
        agentName,
        envelope.eventName,
        envelope.payload,
      ),
    );
  }

  const id = env.KALP_RUNTIME_CLOUDFLARE.idFromName(agentName);
  const stub = env.KALP_RUNTIME_CLOUDFLARE.get(id);

  const proxiedUrl = new URL(request.url);
  proxiedUrl.pathname = passthroughPath === "/" ? "/" : passthroughPath;
  const headers = new Headers(request.headers);
  headers.set("x-kalp-agent-name", agentName);
  headers.set("x-kalp-route-public", String(access.isPublic));

  const proxyRequest = new Request(proxiedUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  });

  return stub.fetch(proxyRequest);
}

function mapIndexToStudioAgents(
  entries: Array<{
    name: string;
    hash?: string;
    version?: string | null;
    versionNumber?: number | null;
    workerUrl?: string | null;
    updatedAt?: string;
    label?: string;
    tags?: string[];
  }>,
): StudioAgent[] {
  return entries.map((entry) => ({
    name: entry.name,
    label: entry.label,
    tags: entry.tags ?? [],
    environment: "remote",
    status: entry.workerUrl ? "online" : "offline",
    hash: entry.hash ?? null,
    version: entry.version ?? null,
    versionNumber: entry.versionNumber ?? null,
    lastRemoteHash: entry.hash ?? null,
    lastLocalHash: null,
    workerUrl: entry.workerUrl ?? null,
    localPath: null,
    updatedAt: entry.updatedAt ?? null,
  }));
}

function createRuntimeApp() {
  const app = new Hono<{
    Bindings: RuntimeBindings;
    Variables: RuntimeVariables;
  }>();

  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    await next();
    c.res = withCors(c.res);
  });

  app.post("/api/internal/auth", async (c) => {
    const secret = c.env.KALP_SECRET_KEY;
    const password = c.env.KALP_STUDIO_PASSWORD;
    const adminUser = c.env.KALP_STUDIO_ADMIN_USER || "admin";

    if (!secret || !password) {
      return c.json({ error: "Studio auth is not configured." }, 500);
    }

    const body = (await c.req
      .json()
      .catch(() => ({ username: undefined, password: undefined }))) as {
      username?: string;
      password?: string;
    };

    const username = body.username || adminUser;
    if (username !== adminUser || body.password !== password) {
      return c.json({ error: "Invalid credentials." }, 401);
    }

    const isSecure = new URL(c.req.url).protocol === "https:";
    await setSignedCookie(c, SESSION_COOKIE_NAME, username, secret, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecure,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return c.json({ ok: true, user: { username } });
  });

  app.get("/api/internal/session", async (c) => {
    const session = await readSession(c);
    if (!session) return c.json({ authenticated: false }, 401);
    return c.json({ authenticated: true, user: session });
  });

  app.post("/api/internal/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  app.use("/api/internal/agents*", requireSession);
  app.use("/api/internal/executions*", requireSession);
  app.use("/api/internal/events*", requireSession);

  app.get("/api/internal/agents", async (c) => {
    const runtimeMode = inferRuntimeMode(c);
    if (runtimeMode === "remote") {
      const raw = await c.env.KALP_MANIFESTS.get("agents:index");
      let parsed: Array<{
        name: string;
        hash?: string;
        version?: string | null;
        versionNumber?: number | null;
        workerUrl?: string | null;
        updatedAt?: string;
        label?: string;
        tags?: string[];
      }> | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
      return c.json({
        generatedAt: new Date().toISOString(),
        projectPath: snapshot.projectPath,
        workerUrl: snapshot.workerUrl,
        mode: "remote",
        agents: parsed ? mapIndexToStudioAgents(parsed) : snapshot.agents,
      });
    }
    return c.json({
      generatedAt: snapshot.generatedAt,
      projectPath: snapshot.projectPath,
      workerUrl: snapshot.workerUrl,
      mode: runtimeMode,
      agents: snapshot.agents,
    });
  });

  app.get("/api/internal/agents/:agentName", async (c) => {
    const agentName = c.req.param("agentName");
    const runtimeMode = inferRuntimeMode(c);
    if (runtimeMode === "remote") {
      const manifest = await readLatestManifest(c.env, agentName);
      if (!manifest) {
        return c.json({ error: `Agent "${agentName}" not found.` }, 404);
      }
      const metadata = manifest.metadata ?? {};
      return c.json({
        name: metadata.name ?? agentName,
        label: metadata.label,
        tags: metadata.tags ?? [],
        environment: "remote",
        status: "online",
        hash: null,
        version: null,
        versionNumber: null,
        lastRemoteHash: null,
        lastLocalHash: null,
        workerUrl: snapshot.workerUrl
          ? `${snapshot.workerUrl.replace(/\/$/, "")}/a/${agentName}`
          : null,
        localPath: null,
        updatedAt: null,
        public: metadata.public ?? false,
        routesPublic: metadata.routesPublic ?? {},
        listeners: metadata.listeners ?? [],
      });
    }
    const agent = snapshot.agents.find((item) => item.name === agentName);
    if (!agent) {
      return c.json({ error: `Agent "${agentName}" not found.` }, 404);
    }
    return c.json(agent);
  });

  app.get("/api/internal/executions", (c) => {
    return c.json([]);
  });

  app.get("/api/internal/events/:executionId", (c) => {
    return c.json([]);
  });

  app.all("/a/:agentName/*", async (c) => {
    return forwardToAgentDO(c, c.req.raw, c.env);
  });

  app.all("/a/:agentName", async (c) => {
    return forwardToAgentDO(c, c.req.raw, c.env);
  });

  app.get("/studio", (c) => c.redirect("/studio/", 308));

  app.get("/studio/*", async (c) => {
    const pathname = new URL(c.req.url).pathname;
    const assetPath = resolveStudioAssetPath(pathname);
    if (!shouldTreatAsStaticAsset(assetPath)) {
      return serveAsset(c.env, "", c.req.raw);
    }

    const assetResponse = await serveAsset(c.env, assetPath, c.req.raw);
    if (assetResponse.status !== 404) return assetResponse;
    return serveAsset(c.env, "", c.req.raw);
  });

  app.get("/", (c) => c.redirect("/studio/", 308));

  app.notFound(async (c) => {
    if (c.req.path.startsWith("/api/internal")) {
      return c.json({ error: "Not found" }, 404);
    }
    return serveAsset(c.env, "", c.req.raw);
  });

  app.onError((error, c) => {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  });

  return app;
}

const app = createRuntimeApp();

export default app;
