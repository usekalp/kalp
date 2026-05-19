import { describe, it, expect } from "vitest";
import { createMcpContext } from "../../src/effects/primitives/mcp";
import { createInterceptorMock } from "../helpers/interceptor-mock";

describe("createMcpContext", () => {
  it("should call MCP tool via proxy", async () => {
    const { interceptEffect, calls } = createInterceptorMock({
      "mcp.call": () => ({ result: "ok" }),
    });
    const mcp = createMcpContext(interceptEffect);
    const result = await (mcp as any).wikipedia.search({ query: "Buenos Aires" });
    expect(calls[0]).toMatchObject({
      type: "mcp.call",
      payload: { server: "wikipedia", tool: "search", args: { query: "Buenos Aires" } },
    });
    expect(result).toEqual({ result: "ok" });
  });

  it("should support nested server and tool chains", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const mcp = createMcpContext(interceptEffect);
    await (mcp as any).github.getRepo({ owner: "test" });
    expect(calls[0]).toMatchObject({
      payload: { server: "github", tool: "getRepo", args: { owner: "test" } },
    });
  });

  it("should handle calls without args", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const mcp = createMcpContext(interceptEffect);
    await (mcp as any).server.listTools();
    expect(calls[0]).toMatchObject({
      payload: { server: "server", tool: "listTools", args: undefined },
    });
  });
});
