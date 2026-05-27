import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRpcPayload,
  postJsonRpc,
  initializeServer,
  MCP_PROTOCOL_VERSION,
} from "@/utils/mcp/rpc-client";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createRpcPayload", () => {
  it("creates payload with params", () => {
    const payload = createRpcPayload(1, "test/method", { key: "value" });

    expect(payload).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "test/method",
      params: { key: "value" },
    });
  });

  it("creates payload without params", () => {
    const payload = createRpcPayload(2, "test/notifications");

    expect(payload).toEqual({
      jsonrpc: "2.0",
      id: 2,
      method: "test/notifications",
    });
  });

  it("works with string id", () => {
    const payload = createRpcPayload("list-1", "tools/list", {});

    expect(payload.id).toBe("list-1");
  });

  it("does not include params key when params is undefined", () => {
    const payload = createRpcPayload(1, "method");

    expect(payload).not.toHaveProperty("params");
  });
});

describe("initializeServer", () => {
  it("calls initialize and negotiated version", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    // First call: initialize response with SSE-like body
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "mcp-session-id": "session-abc" }),
      text: async () =>
        'event: message\r\ndata: {"jsonrpc":"2.0","result":{"protocolVersion":"2025-03-26"}}\r\n\r\n',
    } as Response);

    // Second call: notifications/initialized response
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => "{}",
    } as Response);

    const version = await initializeServer("https://mcp.example.com", {});

    expect(version).toBe("2025-03-26");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws on error response from initialize", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () =>
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Server error" },
        }),
    } as Response);

    await expect(
      initializeServer("https://mcp.example.com", {}),
    ).rejects.toThrow("initialize failed (-32000): Server error");
  });

  it("falls back to MCP_PROTOCOL_VERSION when server returns no version", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "mcp-session-id": "sess-1" }),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: {} }),
    } as Response);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => "{}",
    } as Response);

    const version = await initializeServer("https://mcp.example.com", {});

    expect(version).toBe(MCP_PROTOCOL_VERSION);
  });

  it("uses default version when protocolVersion is not a string", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "mcp-session-id": "sess-1" }),
      text: async () =>
        JSON.stringify({ jsonrpc: "2.0", result: { protocolVersion: 42 } }),
    } as Response);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => "{}",
    } as Response);

    const version = await initializeServer("https://mcp.example.com", {});

    expect(version).toBe(MCP_PROTOCOL_VERSION);
  });
});

describe("postJsonRpc", () => {
  it("sends fetch with JSON body and parses response", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: { data: "ok" } }),
    } as Response);

    const body = createRpcPayload(1, "test/method", {});
    const response = await postJsonRpc<{ data: string }>(
      "https://mcp.example.com",
      body,
      MCP_PROTOCOL_VERSION,
    );

    expect("result" in response).toBe(true);
    if ("result" in response) {
      expect(response.result).toEqual({ data: "ok" });
    }
  });

  it("passes extraHeaders in request", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: {} }),
    } as Response);

    await postJsonRpc(
      "https://mcp.example.com",
      createRpcPayload(1, "test"),
      MCP_PROTOCOL_VERSION,
      { authorization: "Bearer token123" },
    );

    const callHeaders = fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(callHeaders.authorization).toBe("Bearer token123");
  });

  it("sets content-type and MCP-Protocol-Version headers", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: {} }),
    } as Response);

    await postJsonRpc(
      "https://mcp.example.com",
      createRpcPayload(1, "test"),
      "custom-version",
    );

    const callHeaders = fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(callHeaders["content-type"]).toBe("application/json");
    expect(callHeaders["MCP-Protocol-Version"]).toBe("custom-version");
    expect(callHeaders.accept).toBe("application/json, text/event-stream");
  });

  it("handles SSE streaming response format", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () =>
        "event: message\r\ndata: {\"jsonrpc\":\"2.0\",\"result\":{\"tools\":[{\"name\":\"t1\"}]}}\r\n\r\n",
    } as Response);

    const response = await postJsonRpc<{ tools: unknown[] }>(
      "https://mcp.example.com",
      createRpcPayload(1, "tools/list"),
      MCP_PROTOCOL_VERSION,
    );

    expect("result" in response).toBe(true);
    if ("result" in response) {
      expect(response.result).toEqual({ tools: [{ name: "t1" }] });
    }
  });

  it("throws on HTTP error response", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({}),
      text: async () => "Internal Server Error",
    } as Response);

    await expect(
      postJsonRpc(
        "https://mcp.example.com",
        createRpcPayload(1, "test"),
        MCP_PROTOCOL_VERSION,
      ),
    ).rejects.toThrow("Request failed with HTTP 500");
  });

  it("throws when JSON response is invalid", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => "not json at all",
    } as Response);

    await expect(
      postJsonRpc(
        "https://mcp.example.com",
        createRpcPayload(1, "test"),
        MCP_PROTOCOL_VERSION,
      ),
    ).rejects.toThrow("Invalid JSON-RPC response payload");
  });

  it("throws when JSON does not parse to an object", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => '"just a string"',
    } as Response);

    await expect(
      postJsonRpc(
        "https://mcp.example.com",
        createRpcPayload(1, "test"),
        MCP_PROTOCOL_VERSION,
      ),
    ).rejects.toThrow("Invalid JSON-RPC response shape");
  });

  it("stores and uses session ID from headers", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    // First call: sets session header
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "mcp-session-id": "my-session" }),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: {} }),
    } as Response);

    // Second call: should include MCP-Session-Id
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: {} }),
    } as Response);

    await postJsonRpc(
      "https://mcp.example.com",
      createRpcPayload(1, "test"),
      MCP_PROTOCOL_VERSION,
    );

    await postJsonRpc(
      "https://mcp.example.com",
      createRpcPayload(2, "test"),
      MCP_PROTOCOL_VERSION,
    );

    const secondCallHeaders = fetchSpy.mock.calls[1]![1]!.headers as Record<string, string>;
    expect(secondCallHeaders["MCP-Session-Id"]).toBe("my-session");
  });

  it("extracts session ID from SSE id: line", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    // First call: no mcp-session-id header, but SSE body has id:
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () =>
        "id: sse-session-id\r\nevent: message\r\ndata: {\"jsonrpc\":\"2.0\",\"result\":{}}\r\n\r\n",
    } as Response);

    // Second call: should include the SSE-sourced session
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: {} }),
    } as Response);

    await postJsonRpc(
      "https://mcp.example.com",
      createRpcPayload(1, "test"),
      MCP_PROTOCOL_VERSION,
    );

    await postJsonRpc(
      "https://mcp.example.com",
      createRpcPayload(2, "test"),
      MCP_PROTOCOL_VERSION,
    );

    const secondCallHeaders = fetchSpy.mock.calls[1]![1]!.headers as Record<string, string>;
    expect(secondCallHeaders["MCP-Session-Id"]).toBe("sse-session-id");
  });

  it("returns error response when server sends error", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () =>
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
        }),
    } as Response);

    const response = await postJsonRpc<unknown>(
      "https://mcp.example.com",
      createRpcPayload(1, "unknown"),
      MCP_PROTOCOL_VERSION,
    );

    expect("error" in response).toBe(true);
    if ("error" in response) {
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe("Method not found");
    }
  });

  it("sends JSON.stringify of body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({}),
      text: async () => JSON.stringify({ jsonrpc: "2.0", result: {} }),
    } as Response);

    const body = { jsonrpc: "2.0", id: 1, method: "test", params: { n: 1 } };
    await postJsonRpc("https://mcp.example.com", body, MCP_PROTOCOL_VERSION);

    expect(fetchSpy.mock.calls[0]![1]!.body).toBe(JSON.stringify(body));
  });
});
