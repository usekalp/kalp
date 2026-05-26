import { verifyGatewayAuth } from "@/studio/auth";
import { recordExecution } from "./executions";

export type RuntimeBindings = Env & {
  KALP_SECRET_KEY?: string;
  KALP_STUDIO_PASSWORD?: string;
  KALP_STUDIO_ADMIN_USER?: string;
  KALP_SERVICE_KEY?: string;
  KALP_ENFORCE_GLOBAL_AUTH?: string;
  KALP_ENV?: "local" | "remote";
  KALP_RUNTIME_MODE?: "local" | "remote";
  KALP_IDENTITY_CONFIG?: string;
};

async function readLatestManifest(
  env: RuntimeBindings,
  agentName: string,
): Promise<Record<string, unknown> | null> {
  const latest = await env.KALP_MANIFESTS.get(`${agentName}:latest`);
  if (!latest) return null;
  const raw = await env.KALP_MANIFESTS.get(
    `${agentName}:${latest}:semantic-ir`,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveAgentAccess(
  env: RuntimeBindings,
  agentName: string,
  _routeKey: string,
): Promise<{ isPublic: boolean }> {
  const manifest = await readLatestManifest(env, agentName);
  const agentPublic =
    (manifest?.agent as Record<string, unknown> | undefined)?.skipAuth ?? false;
  return { isPublic: agentPublic as boolean };
}

export function getAgentRouting(url: URL): {
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

const LISTENERS_QUEUE_KEY = "listeners:queue";

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

export async function invokeAgentRuntime(params: {
  env: RuntimeBindings;
  agentName: string;
  pathname: string;
  method: string;
  headers: Headers;
  body: BodyInit | null;
  requestUrl: string;
  source: Record<string, unknown>;
  threadId?: string;
  traceId?: string;
}) {
  const {
    env,
    agentName,
    pathname,
    method,
    headers,
    body,
    requestUrl,
    source,
    threadId,
    traceId,
  } = params;

  const id = env.KALP_RUNTIME_CLOUDFLARE.idFromName(agentName);
  const stub = env.KALP_RUNTIME_CLOUDFLARE.get(id);

  return recordExecution({
    env,
    agentName,
    source,
    input: { pathname, method },
    run: async ({ executionId }) => {
      const nextHeaders = new Headers(headers);
      nextHeaders.set("x-kalp-agent-name", agentName);
      nextHeaders.set("x-kalp-execution-id", executionId);
      if (threadId) nextHeaders.set("x-kalp-thread-id", threadId);
      if (traceId) nextHeaders.set("x-kalp-trace-id", traceId);

      const proxiedUrl = new URL(requestUrl);
      proxiedUrl.pathname = pathname === "/" ? "/" : pathname;
      const proxyRequest = new Request(proxiedUrl.toString(), {
        method,
        headers: nextHeaders,
        body,
      });

      const response = await stub.fetch(proxyRequest);
      const clone = response.clone();
      const text = await clone.text();
      try {
        return JSON.parse(text);
      } catch {
        return { text, status: response.status };
      }
    },
  });
}

export async function forwardToAgentDO(
  c: { req: { raw: Request; url: string; method: string; path: string }; json: (body: unknown, status?: number) => Response; env: RuntimeBindings; executionCtx?: { waitUntil(promise: Promise<unknown>): void } },
  request: Request,
  env: RuntimeBindings,
) {
  const url = new URL(request.url);
  const { agentName, passthroughPath } = getAgentRouting(url);
  const routeKey = `${request.method.toUpperCase()}:${passthroughPath === "/" ? "/" : passthroughPath}`;
  const access = await resolveAgentAccess(env, agentName, routeKey);
  if (!access.isPublic) {
    const identity = await verifyGatewayAuth(
      env as unknown as Record<string, unknown>,
      request.headers.get("Authorization"),
      request,
    );
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

  const threadId = request.headers.get("x-kalp-thread-id") || undefined;
  const traceId = request.headers.get("x-kalp-trace-id") || undefined;

  const result = await invokeAgentRuntime({
    env,
    agentName,
    pathname: passthroughPath,
    method: request.method,
    headers: request.headers,
    body: request.body,
    requestUrl: request.url,
    source: {
      type: "http",
      method: request.method.toUpperCase(),
      path: passthroughPath,
      ...(threadId ? { threadId } : {}),
      ...(traceId ? { traceId } : {}),
    },
    threadId,
    traceId,
  });

  return c.json({
    ok: true,
    executionId: result.executionId,
    result: result.output,
  });
}