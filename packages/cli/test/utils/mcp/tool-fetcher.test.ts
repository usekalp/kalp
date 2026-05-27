import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchServerTools } from "@/utils/mcp/tool-fetcher";
import type { McpServerConfigInput } from "@/utils/mcp/server-config";

const { mockInitializeServer, mockPostJsonRpc } = vi.hoisted(() => ({
  mockInitializeServer: vi.fn(),
  mockPostJsonRpc: vi.fn(),
}));

vi.mock("@/utils/mcp/rpc-client", () => ({
  createRpcPayload: (id: number | string, method: string, params?: Record<string, unknown>) => ({
    jsonrpc: "2.0",
    id,
    method,
    ...(params ? { params } : {}),
  }),
  initializeServer: mockInitializeServer,
  postJsonRpc: mockPostJsonRpc,
  MCP_CLIENT_NAME: "kalp-cli",
  MCP_PROTOCOL_VERSION: "2025-06-18",
}));

function makeConfig(overrides: Partial<McpServerConfigInput> = {}): McpServerConfigInput {
  return {
    transport: "sse",
    url: "https://mcp.example.com",
    headers: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchServerTools", () => {
  it("skips non-SSE transport with warning", async () => {
    const config: McpServerConfigInput = {
      transport: "stdio",
      url: "command",
      headers: {},
    };

    const result = await fetchServerTools("stdio-server", config);

    expect(result.tools).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("stdio");
    expect(result.warnings[0]).toContain("Only \"sse\" transport is supported");
    expect(mockInitializeServer).not.toHaveBeenCalled();
  });

  it("initializes server and fetches tools (single page)", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({
      result: {
        tools: [
          { name: "tool-a", inputSchema: { type: "object" } },
          { name: "tool-b" },
        ],
      },
    });

    const result = await fetchServerTools("test-server", makeConfig());

    expect(mockInitializeServer).toHaveBeenCalledWith(
      "https://mcp.example.com",
      {},
    );
    expect(result.serverName).toBe("test-server");
    expect(result.transport).toBe("sse");
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0]!.name).toBe("tool-a");
    expect(result.tools[1]!.name).toBe("tool-b");
    expect(result.warnings).toEqual([]);
  });

  it("sorts tools alphabetically by name", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({
      result: {
        tools: [
          { name: "z-tool" },
          { name: "a-tool" },
          { name: "m-tool" },
        ],
      },
    });

    const result = await fetchServerTools("sort-server", makeConfig());

    expect(result.tools.map((t) => t.name)).toEqual(["a-tool", "m-tool", "z-tool"]);
  });

  it("fetches tools across multiple pages using cursor", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc
      .mockResolvedValueOnce({
        result: {
          tools: [{ name: "page1-tool" }],
          nextCursor: "cursor-2",
        },
      })
      .mockResolvedValueOnce({
        result: {
          tools: [{ name: "page2-tool" }],
        },
      });

    const result = await fetchServerTools("paged-server", makeConfig());

    expect(mockPostJsonRpc).toHaveBeenCalledTimes(2);
    expect(result.tools.map((t) => t.name)).toEqual(["page1-tool", "page2-tool"]);
  });

  it("deduplicates tools with same name across pages", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc
      .mockResolvedValueOnce({
        result: {
          tools: [{ name: "dup-tool" }],
          nextCursor: "cursor-2",
        },
      })
      .mockResolvedValueOnce({
        result: {
          tools: [{ name: "dup-tool" }, { name: "unique-tool" }],
        },
      });

    const result = await fetchServerTools("dup-server", makeConfig());

    expect(result.tools).toHaveLength(2);
    expect(result.tools.map((t) => t.name).sort()).toEqual(["dup-tool", "unique-tool"]);
  });

  it("throws when tools/list returns error", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({
      error: { code: -32000, message: "Internal error" },
    });

    await expect(
      fetchServerTools("err-server", makeConfig()),
    ).rejects.toThrow("tools/list failed (-32000): Internal error");
  });

  it("stops pagination when nextCursor is the same as current cursor", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc
      .mockResolvedValueOnce({
        result: {
          tools: [{ name: "t1" }],
          nextCursor: "same-cursor",
        },
      })
      .mockResolvedValueOnce({
        result: {
          tools: [{ name: "t2" }],
          nextCursor: "same-cursor",
        },
      });

    const result = await fetchServerTools("loop-server", makeConfig());

    expect(result.tools).toHaveLength(2);
    expect(mockPostJsonRpc).toHaveBeenCalledTimes(2);
  });

  it("adds warning when pagination safety limit is reached (200 pages)", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");

    for (let i = 0; i < 200; i++) {
      mockPostJsonRpc.mockResolvedValueOnce({
        result: {
          tools: [{ name: `tool-${i}` }],
          nextCursor: `cursor-${i + 1}`,
        },
      });
    }

    const result = await fetchServerTools("flood-server", makeConfig());

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("pagination safety limit");
    expect(mockPostJsonRpc).toHaveBeenCalledTimes(200);
  });

  it("parses tools with inputSchema and outputSchema", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({
      result: {
        tools: [
          {
            name: "full-tool",
            inputSchema: { type: "object", properties: {} },
            outputSchema: { type: "string" },
          },
        ],
      },
    });

    const result = await fetchServerTools("full-server", makeConfig());

    expect(result.tools[0]!.inputSchema).toEqual({ type: "object", properties: {} });
    expect(result.tools[0]!.outputSchema).toEqual({ type: "string" });
  });

  it("skips items in tools array that are not objects", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({
      result: {
        tools: [
          "not-an-object",
          null,
          { name: "valid-tool" },
          42,
        ],
      },
    });

    const result = await fetchServerTools("mixed-server", makeConfig());

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]!.name).toBe("valid-tool");
  });

  it("skips items with empty name", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({
      result: {
        tools: [
          { name: "" },
          { name: "   " },
          { name: "valid" },
        ],
      },
    });

    const result = await fetchServerTools("empty-name-server", makeConfig());

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]!.name).toBe("valid");
  });

  it("handles empty result object", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({ result: {} });

    const result = await fetchServerTools("empty-server", makeConfig());

    expect(result.tools).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("handles null result", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({ result: null });

    const result = await fetchServerTools("null-server", makeConfig());

    expect(result.tools).toEqual([]);
  });

  it("passes config headers to initializeServer", async () => {
    mockInitializeServer.mockResolvedValueOnce("2025-06-18");
    mockPostJsonRpc.mockResolvedValueOnce({
      result: { tools: [] },
    });

    const config = makeConfig({ headers: { authorization: "Bearer secret" } });

    await fetchServerTools("hdrs", config);

    expect(mockInitializeServer).toHaveBeenCalledWith(
      "https://mcp.example.com",
      { authorization: "Bearer secret" },
    );
  });
});
