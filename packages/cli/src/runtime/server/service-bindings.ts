import type { RuntimeRegistry } from "../registry/runtime-registry";
import type { GracefulDrain } from "./graceful-drain";

export class ServiceBindings {
  static create(registry: RuntimeRegistry, drain: GracefulDrain): Record<string, unknown> {
    return {
      KALP_REGISTRY: async (request: Request) => {
        const url = new URL(request.url);
        const { pathname } = url;

        if (pathname === "/resolve") {
          const body = await request.json().catch(() => ({}));
          const result = await registry.handleResolve(body.agentName);
          if (!result) return new Response("not found", { status: 404 });
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        }

        if (pathname === "/invoke") {
          if (drain.isDraining) {
            return new Response(JSON.stringify({ error: "restarting" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          }

          if (!drain.startExecution()) {
            return new Response(JSON.stringify({ error: "restarting" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          }

          try {
            const body = await request.json().catch(() => ({}));
            const output = await registry.handleInvoke({
              agentName: body.agentName,
              executionId: body.executionId,
              nodeId: body.nodeId,
              input: body.input,
            });
            return new Response(JSON.stringify(output), {
              headers: { "content-type": "application/json" },
            });
          } finally {
            drain.endExecution();
          }
        }

        return new Response("unknown endpoint", { status: 400 });
      },
    };
  }
}
