import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import agentsSnapshot from "./agents.snapshot.json";

const SESSION_COOKIE_NAME = "kalp_studio_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(response) {
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

function resolveStudioAssetPath(pathname) {
  if (pathname === "/studio" || pathname === "/studio/") return "";
  const stripped = pathname.replace(/^\/studio\//, "");
  return stripped || "";
}

async function serveAsset(env, assetPath, request) {
  const assetUrl = new URL(request.url);
  assetUrl.hostname = "assets.local";
  assetUrl.pathname = assetPath ? `/${assetPath.replace(/^\/+/, "")}` : "/";
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function shouldTreatAsStaticAsset(assetPath) {
  if (!assetPath) return false;
  if (assetPath.startsWith("assets/")) return true;
  if (assetPath === "favicon.ico") return true;
  if (assetPath === "manifest.json") return true;
  if (assetPath === "robots.txt") return true;
  return assetPath.includes(".");
}

async function readSession(c) {
  const secret = c.env.KALP_SECRET_KEY;
  if (!secret) return null;

  const username = await getSignedCookie(c, secret, SESSION_COOKIE_NAME);
  if (!username || typeof username !== "string") return null;
  return { username };
}

async function requireSession(c, next) {
  const session = await readSession(c);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("session", session);
  return next();
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
      `${agentName}:${latestHash}`,
    );
    if (!manifestRaw) {
      throw new Error(
        `Manifest "${agentName}:${latestHash}" not found in KALP_MANIFESTS.`,
      );
    }

    const manifest = JSON.parse(manifestRaw);
    this.currentAgentName = agentName;
    this.currentManifestHash = latestHash;
    this.currentManifest = manifest;
    return { hash: latestHash, manifest };
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

    const eventType =
      url.pathname === "/" || url.pathname === ""
        ? "onMessage"
        : `route:${url.pathname}`;
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
        entries: Object.keys(manifest.entries || {}),
      },
    });
  }
}

function getAgentRouting(url) {
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

async function forwardToAgentDO(request, env) {
  const url = new URL(request.url);
  const { agentName, passthroughPath } = getAgentRouting(url);
  const id = env.KALP_RUNTIME_CLOUDFLARE.idFromName(agentName);
  const stub = env.KALP_RUNTIME_CLOUDFLARE.get(id);

  const proxiedUrl = new URL(request.url);
  proxiedUrl.pathname = passthroughPath === "/" ? "/" : passthroughPath;
  const headers = new Headers(request.headers);
  headers.set("x-kalp-agent-name", agentName);

  const proxyRequest = new Request(proxiedUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  });

  return stub.fetch(proxyRequest);
}

const app = new Hono();

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

  const body = await c.req
    .json()
    .catch(() => ({ username: undefined, password: undefined }));
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

app.post("/api/internal/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

app.use("/api/internal/agents*", requireSession);
app.use("/api/internal/executions*", requireSession);
app.use("/api/internal/events*", requireSession);

app.get("/api/internal/agents", (c) => {
  return c.json({
    generatedAt: agentsSnapshot.generatedAt,
    projectPath: agentsSnapshot.projectPath,
    workerUrl: agentsSnapshot.workerUrl,
    agents: agentsSnapshot.agents,
  });
});

app.get("/api/internal/agents/:agentName", (c) => {
  const agentName = c.req.param("agentName");
  const agent = agentsSnapshot.agents.find((item) => item.name === agentName);
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
  return forwardToAgentDO(c.req.raw, c.env);
});

app.all("/a/:agentName", async (c) => {
  return forwardToAgentDO(c.req.raw, c.env);
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

export default app;
