import {
  handleStudioLogin,
  handleStudioLogout,
  readSession,
  requireSession,
} from "./auth.js";
import { handleChatMessage } from "./chat.js";
import { forwardToAgentDO, invokeAgentRuntime } from "./agent-runtime.js";
import {
  resolveAgentChatCapabilities,
  resolveChatSessions,
  resolveAgentDetails,
  resolveAgentMetadata,
  resolveContracts,
  resolveEntrypoints,
  resolveExecutionEvents,
  resolveExecutionSummaries,
  resolveRoutingTable,
  resolveRuntimeSystemStatus,
  resolveTriggers,
  resolveAgentState,
} from "./resolvers.js";
import { listAgentNamesFromKv, readChatMessages } from "./storage.js";

export function registerStudioRoutes(app, agentsSnapshot) {
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
      agentNames.map((agentName) => resolveAgentMetadata(c.env, agentName, c.req.url)),
    );

    return c.json({
      generatedAt: new Date().toISOString(),
      projectPath: agentsSnapshot.projectPath,
      workerUrl: agentsSnapshot.workerUrl,
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
    return c.json(await resolveAgentChatCapabilities(c.env, c.req.param("agentName")));
  });

  app.get("/api/internal/agents/:agentName/chat/sessions", async (c) => {
    return c.json(await resolveChatSessions(c.env, c.req.param("agentName")));
  });

  app.post("/api/internal/agents/:agentName/chat", async (c) => {
    const agentName = c.req.param("agentName");
    const body = await c.req
      .json()
      .catch(() => ({ message: "", sessionId: undefined, stream: false }));
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
          headers: new Headers({
            "content-type": "application/json",
          }),
          body: JSON.stringify({
            message,
            sessionId: body.sessionId,
          }),
          requestUrl: c.req.url,
          source: {
            type: "chat",
          },
        });
        return invoked.output;
      },
    });

    return c.json({
      session: result.session,
      executionId: result.executionId,
      message: result.message,
      stream: false,
    });
  });

  app.get("/api/internal/agents/:agentName/chat/:sessionId/messages", async (c) => {
    const { agentName, sessionId } = c.req.param();
    return c.json(await readChatMessages(c.env, agentName, sessionId));
  });

  app.get("/api/internal/agents/:agentName/executions", async (c) => {
    return c.json(await resolveExecutionSummaries(c.env, c.req.param("agentName")));
  });

  app.get("/api/internal/agents/:agentName/executions/:executionId", async (c) => {
    const { agentName, executionId } = c.req.param();
    const summaries = await resolveExecutionSummaries(c.env, agentName);
    const summary = summaries.find((item) => item.id === executionId) ?? null;
    return c.json(summary ?? { error: "Execution not found" }, summary ? 200 : 404);
  });

  app.get(
    "/api/internal/agents/:agentName/executions/:executionId/events",
    async (c) => {
      const { agentName, executionId } = c.req.param();
      return c.json(await resolveExecutionEvents(c.env, agentName, executionId));
    },
  );

  app.get("/api/internal/executions", async (c) => {
    const agentNames = await listAgentNamesFromKv(c.env);
    const grouped = await Promise.all(
      agentNames.map((agentName) => resolveExecutionSummaries(c.env, agentName)),
    );
    return c.json(grouped.flat().sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))));
  });

  app.get("/api/internal/events/:executionId", async (c) => {
    const executionId = c.req.param("executionId");
    const agentNames = await listAgentNamesFromKv(c.env);
    for (const agentName of agentNames) {
      const events = await resolveExecutionEvents(c.env, agentName, executionId);
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
}
