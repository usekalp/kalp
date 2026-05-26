import { Hono } from "hono";
import type { StudioSession } from "./auth/types";
import { handleStudioLogin, handleStudioLogout, readSession, requireSession } from "./auth";
import {
  resolveRuntimeSystemStatus,
  resolveAgentMetadata,
  resolveRoutingTable,
  resolveContracts,
  resolveEntrypoints,
  resolveTriggers,
  resolveAgentChatCapabilities,
  resolveAgentState,
  resolveExecutionSummaries,
  resolveExecutionEvents,
  resolveChatSessions,
  resolveAgentDetails,
} from "./resolvers";
import { listAgentNamesFromKv, readChatMessages } from "@/kv-storage";
import { handleChatMessage } from "./chat";
import { withCors } from "@/shared/cors";
import { invokeAgentRuntime, forwardToAgentDO, type RuntimeBindings } from "./agent-proxy";
import { resolveStudioAssetPath, serveAsset, shouldTreatAsStaticAsset } from "./assets";

type RuntimeVariables = {
  session: StudioSession;
};

export function createStudioApp() {
  const app = new Hono<{
    Bindings: RuntimeBindings;
    Variables: RuntimeVariables;
  }>();

  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }
    await next();
    c.res = withCors(c.res);
  });

  app.post("/api/internal/auth", handleStudioLogin);

  app.get("/api/internal/session", async (c) => {
    const session = await readSession(c);
    if (!session) return c.json({ authenticated: false }, 401);
    return c.json({ authenticated: true, user: session });
  });

  app.post("/api/internal/logout", handleStudioLogout);

  app.use("/api/internal/agents*", requireSession);
  app.use("/api/internal/runtime*", requireSession);
  app.use("/api/internal/executions*", requireSession);
  app.use("/api/internal/events*", requireSession);

  app.get("/api/internal/runtime/system", async (c) => {
    const system = await resolveRuntimeSystemStatus(c.env);
    return c.json(system);
  });

  app.get("/api/internal/agents", async (c) => {
    const agentNames = await listAgentNamesFromKv(c.env);
    const agents = await Promise.all(
      agentNames.map((agentName) =>
        resolveAgentMetadata(c.env, agentName, c.req.url),
      ),
    );

    return c.json({
      generatedAt: new Date().toISOString(),
      projectPath: "",
      workerUrl: null,
      mode: c.env.KALP_ENV === "remote" ? "remote" : "local",
      agents,
    });
  });

  app.get("/api/internal/agents/:agentName", async (c) => {
    const agentName = c.req.param("agentName");
    const details = await resolveAgentDetails(c.env, agentName, c.req.url);
    return c.json(details);
  });

  app.get("/api/internal/agents/:agentName/entrypoints", async (c) => {
    return c.json(await resolveEntrypoints(c.env, c.req.param("agentName")));
  });

  app.get("/api/internal/agents/:agentName/routes", async (c) => {
    return c.json(await resolveRoutingTable(c.env, c.req.param("agentName")));
  });

  app.get("/api/internal/agents/:agentName/triggers", async (c) => {
    return c.json(await resolveTriggers(c.env, c.req.param("agentName")));
  });

  app.get("/api/internal/agents/:agentName/contracts", async (c) => {
    return c.json(await resolveContracts(c.env, c.req.param("agentName")));
  });

  app.get("/api/internal/agents/:agentName/state", async (c) => {
    return c.json(await resolveAgentState(c.env, c.req.param("agentName")));
  });

  app.get("/api/internal/agents/:agentName/chat-capabilities", async (c) => {
    return c.json(
      await resolveAgentChatCapabilities(c.env, c.req.param("agentName")),
    );
  });

  app.get("/api/internal/agents/:agentName/chat/sessions", async (c) => {
    return c.json(await resolveChatSessions(c.env, c.req.param("agentName")));
  });

  app.post("/api/internal/agents/:agentName/chat", async (c) => {
    const agentName = c.req.param("agentName");
    const body = (await c.req
      .json()
      .catch(() => ({ message: "", sessionId: undefined }))) as {
      message?: string;
      sessionId?: string;
    };
    const message =
      typeof body.message === "string" && body.message.trim().length > 0
        ? body.message.trim()
        : "";

    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }

    const result = await handleChatMessage({
      env: c.env,
      agentName,
      message,
      sessionId:
        typeof body.sessionId === "string" && body.sessionId.length > 0
          ? body.sessionId
          : undefined,
      invoke: async () => {
        const invoked = await invokeAgentRuntime({
          env: c.env,
          agentName,
          pathname: "/",
          method: "POST",
          headers: new Headers({ "content-type": "application/json" }),
          body: JSON.stringify({ message, sessionId: body.sessionId }),
          requestUrl: c.req.url,
          source: { type: "chat", agentName },
        });
        return invoked;
      },
    });

    return c.json({
      session: result.session,
      executionId: result.executionId,
      message: result.message,
      stream: false,
    });
  });

  app.get(
    "/api/internal/agents/:agentName/chat/:sessionId/messages",
    async (c) => {
      const { agentName, sessionId } = c.req.param();
      return c.json(await readChatMessages(c.env, agentName, sessionId));
    },
  );

  app.get("/api/internal/agents/:agentName/executions", async (c) => {
    return c.json(
      await resolveExecutionSummaries(c.env, c.req.param("agentName")),
    );
  });

  app.get(
    "/api/internal/agents/:agentName/executions/:executionId",
    async (c) => {
      const { agentName, executionId } = c.req.param();
      const summaries = await resolveExecutionSummaries(c.env, agentName);
      const summary =
        summaries.find(
          (item: Record<string, unknown>) => item.id === executionId,
        ) ?? null;
      return c.json(
        summary ?? { error: "Execution not found" },
        summary ? 200 : 404,
      );
    },
  );

  app.get(
    "/api/internal/agents/:agentName/executions/:executionId/events",
    async (c) => {
      const { agentName, executionId } = c.req.param();
      return c.json(
        await resolveExecutionEvents(c.env, agentName, executionId),
      );
    },
  );

  app.get("/api/internal/executions", async (c) => {
    const agentNames = await listAgentNamesFromKv(c.env);
    const grouped = await Promise.all(
      agentNames.map((agentName) =>
        resolveExecutionSummaries(c.env, agentName),
      ),
    );
    return c.json(
      grouped
        .flat()
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")),
        ),
    );
  });

  app.get("/api/internal/events/:executionId", async (c) => {
    const executionId = c.req.param("executionId");
    const agentNames = await listAgentNamesFromKv(c.env);
    for (const agentName of agentNames) {
      const events = await resolveExecutionEvents(
        c.env,
        agentName,
        executionId,
      );
      if (events.length > 0) return c.json(events);
    }
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

  app.get("/favicon.ico", async (c) =>
    serveAsset(c.env, "favicon.ico", c.req.raw),
  );
  app.get("/logo192.png", async (c) =>
    serveAsset(c.env, "logo192.png", c.req.raw),
  );
  app.get("/logo512.png", async (c) =>
    serveAsset(c.env, "logo512.png", c.req.raw),
  );
  app.get("/manifest.json", async (c) =>
    serveAsset(c.env, "manifest.json", c.req.raw),
  );
  app.get("/robots.txt", async (c) =>
    serveAsset(c.env, "robots.txt", c.req.raw),
  );

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