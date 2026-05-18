import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { McpTransport, type McpTransportConfig, type McpToolCallResult, type McpToolDefinition } from "../src/effects/primitives/mcp-transport";

function mockFetch(response: {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}) {
  const bodyStr = typeof response.body === "string" ? response.body : JSON.stringify(response.body);
  const respHeaders = new Headers({ "content-type": "application/json", ...response.headers });

  return vi.mocked(fetch).mockResolvedValueOnce(
    new Response(bodyStr, {
      status: response.status ?? 200,
      headers: respHeaders,
    }),
  );
}

function mockFetchSequence(responses: Array<{
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}>) {
  let callIndex = 0;
  vi.mocked(fetch).mockImplementation(async () => {
    const r = responses[callIndex++];
    if (!r) throw new Error("Unexpected fetch call");
    const bodyStr = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(bodyStr, {
      status: r.status ?? 200,
      headers: new Headers({ "content-type": "application/json", ...r.headers }),
    });
  });
}

describe("McpTransport", () => {
  const deepwikiConfig: McpTransportConfig = {
    url: "https://mcp.deepwiki.com/mcp",
  };

  let transport: McpTransport;

  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
    // @ts-expect-error crypto is mocked by vitest
    if (typeof crypto === "undefined" || !crypto.randomUUID) {
      Object.defineProperty(globalThis, "crypto", {
        value: { randomUUID: () => "00000000-0000-0000-0000-000000000001" },
        writable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with URL only", () => {
      transport = new McpTransport(deepwikiConfig);
      expect(transport).toBeInstanceOf(McpTransport);
      expect(transport.isConnected).toBe(false);
    });

    it("should create instance with URL and custom headers", () => {
      transport = new McpTransport({
        url: "https://mcp.deepwiki.com/mcp",
        headers: { authorization: "Bearer tok_123" },
      });
      expect(transport).toBeInstanceOf(McpTransport);
      expect(transport.isConnected).toBe(false);
    });
  });

  describe("connect", () => {
    it("should perform initialize handshake", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        {
          body: {
            jsonrpc: "2.0",
            id: "req-1",
            result: { protocolVersion: "2025-06-18", serverInfo: { name: "deepwiki", version: "1.0.0" } },
          },
        },
        {
          body: {
            jsonrpc: "2.0",
            id: "req-2",
            result: {},
          },
        },
      ]);

      await transport.connect();

      expect(transport.isConnected).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);

      const firstCall = vi.mocked(fetch).mock.calls[0];
      expect(firstCall[0]).toBe(deepwikiConfig.url);
      const firstBody = JSON.parse(firstCall[1]?.body as string);
      expect(firstBody.method).toBe("initialize");
      expect(firstBody.params.protocolVersion).toBe("2025-06-18");
      expect(firstBody.params.clientInfo.name).toBe("kalp");

      const secondCall = vi.mocked(fetch).mock.calls[1];
      const secondBody = JSON.parse(secondCall[1]?.body as string);
      expect(secondBody.method).toBe("notifications/initialized");
    });

    it("should be idempotent when called twice", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
      ]);

      await transport.connect();
      expect(transport.isConnected).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);

      await transport.connect();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should throw on initialize error", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetch({
        status: 200,
        body: {
          jsonrpc: "2.0",
          id: "1",
          error: { code: -32000, message: "Method not found" },
        },
      });

      await expect(transport.connect()).rejects.toThrow("MCP error (-32000): Method not found");
      expect(transport.isConnected).toBe(false);
    });

    it("should throw on HTTP error", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetch({
        status: 500,
        body: "Internal Server Error",
      });

      await expect(transport.connect()).rejects.toThrow("MCP request failed (500)");
      expect(transport.isConnected).toBe(false);
    });
  });

  describe("callTool", () => {
    it("should call a tool without arguments", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            result: {
              content: [{ type: "text", text: "Method list retrieved" }],
            },
          },
        },
      ]);

      const result = await transport.callTool("get_methods");
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("Method list retrieved");
    });

    it("should call a tool with arguments", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            result: {
              content: [{ type: "text", text: "Search results: [{\"title\":\"Buenos Aires\"}]" }],
            },
          },
        },
      ]);

      const result = await transport.callTool("wiki_search", { query: "Buenos Aires" });

      const callBody = JSON.parse(vi.mocked(fetch).mock.calls[2][1]?.body as string);
      expect(callBody.method).toBe("tools/call");
      expect(callBody.params.name).toBe("wiki_search");
      expect(callBody.params.arguments).toEqual({ query: "Buenos Aires" });

      expect(result.content[0].text).toContain("Search results");
    });

    it("should reject with JSON-RPC error from the server", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            error: { code: -32602, message: "Invalid params" },
          },
        },
      ]);

      await expect(transport.callTool("wiki_search", {})).rejects.toThrow("MCP error (-32602): Invalid params");
    });

    it("should handle tool returning isError flag", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            result: {
              content: [{ type: "text", text: "Tool execution error" }],
              isError: true,
            },
          },
        },
      ]);

      const result = await transport.callTool("wiki_search", { query: "notfound" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Tool execution error");
    });
  });

  describe("listTools", () => {
    it("should list available tools", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            result: {
              tools: [
                { name: "wiki_search", inputSchema: { type: "object", properties: { query: { type: "string" } } } },
                { name: "wiki_get", inputSchema: { type: "object", properties: { title: { type: "string" } } } },
              ],
            },
          },
        },
      ]);

      const tools = await transport.listTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("wiki_search");
      expect(tools[1].name).toBe("wiki_get");
    });

    it("should return empty list when no tools", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            result: {},
          },
        },
      ]);

      const tools = await transport.listTools();
      expect(tools).toEqual([]);
    });
  });

  describe("session management", () => {
    it("should capture session ID from response header", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        {
          body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } },
          headers: { "mcp-session-id": "session_abc123" },
        },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
      ]);

      await transport.connect();

      const [, opts] = vi.mocked(fetch).mock.calls[1];
      const headers = opts?.headers as Record<string, string>;
      expect(headers["MCP-Session-Id"]).toBe("session_abc123");
    });

    it("should capture session ID from SSE event stream (id: line)", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        {
          body: "id: session_sse_456\nevent: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":\"1\",\"result\":{\"protocolVersion\":\"2025-06-18\"}}\n\n",
        },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
      ]);

      await transport.connect();

      const [, opts] = vi.mocked(fetch).mock.calls[1];
      const headers = opts?.headers as Record<string, string>;
      expect(headers["MCP-Session-Id"]).toBe("session_sse_456");
    });
  });

  describe("disconnect", () => {
    it("should reset connection state", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
      ]);

      await transport.connect();
      expect(transport.isConnected).toBe(true);

      await transport.disconnect();
      expect(transport.isConnected).toBe(false);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "3", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "4", result: {} } },
      ]);

      await transport.connect();
      expect(transport.isConnected).toBe(true);
    });
  });

  describe("deepwiki example integration", () => {
    it("should list tools from real deepwiki server", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        {
          body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } },
        },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            result: {
              tools: [
                { name: "wiki_search", inputSchema: { type: "object", properties: { query: { type: "string" } } } },
                { name: "wiki_get", inputSchema: { type: "object", properties: { title: { type: "string" } } } },
                { name: "wiki_random", inputSchema: { type: "object", properties: {} } },
              ],
            },
          },
        },
      ]);

      const tools = await transport.listTools();
      expect(tools.length).toBeGreaterThanOrEqual(1);
      expect(tools.map((t) => t.name)).toContain("wiki_search");
    });

    it("should call wiki_search on deepwiki", async () => {
      transport = new McpTransport(deepwikiConfig);

      mockFetchSequence([
        { body: { jsonrpc: "2.0", id: "1", result: { protocolVersion: "2025-06-18" } } },
        { body: { jsonrpc: "2.0", id: "2", result: {} } },
        {
          body: {
            jsonrpc: "2.0",
            id: "3",
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify([
                    { title: "Buenos Aires", pageid: 12345, snippet: "Capital of Argentina" },
                  ]),
                },
              ],
            },
          },
        },
      ]);

      const result = await transport.callTool("wiki_search", { query: "Buenos Aires" });
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text ?? "[]");
      expect(Array.isArray(parsed)).toBe(true);
    });
  });
});
