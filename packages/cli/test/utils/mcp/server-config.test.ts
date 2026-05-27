import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServerConfigInput } from "@/utils/mcp/server-config";

vi.mock("@kalphq/sdk", () => ({
  normalizeMcpServer: vi.fn(),
}));

import { normalizeMcpServer } from "@kalphq/sdk";
import type { NormalizedMcpServer } from "@kalphq/sdk";
import { getServerConfigs } from "@/utils/mcp/server-config";

function mockNormalized(input: any) {
  vi.mocked(normalizeMcpServer).mockReturnValueOnce({
    transport: "sse",
    url: "https://mcp.example.com",
    auth: null,
    ...input,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServerConfigs", () => {
  it("returns empty object for empty input", () => {
    const result = getServerConfigs({});
    expect(result).toEqual({});
  });

  it("returns empty object when mcp is not present", () => {
    const result = getServerConfigs({ other: "value" });
    expect(result).toEqual({});
  });

  it("returns empty object when mcp is not an object", () => {
    vi.mocked(normalizeMcpServer).mockReturnValue({ transport: "sse" as const, url: "", auth: undefined } as unknown as NormalizedMcpServer);

    const result = getServerConfigs({ mcp: "not-an-object" });

    expect(result).toEqual({});
  });

  it("normalizes a simple URL string server", () => {
    mockNormalized({ transport: "sse", url: "https://simple.example.com/sse" });

    const result = getServerConfigs({
      mcp: { "my-server": "https://simple.example.com/sse" },
    });

    expect(normalizeMcpServer).toHaveBeenCalledWith("https://simple.example.com/sse");
    expect(result["my-server"]).toEqual({
      transport: "sse",
      url: "https://simple.example.com/sse",
      headers: {},
    });
  });

  it("normalizes an object server config", () => {
    mockNormalized({
      transport: "sse",
      url: "https://obj.example.com",
    });

    const result = getServerConfigs({
      mcp: {
        "obj-server": {
          transport: "sse",
          url: "https://obj.example.com",
        },
      },
    });

    expect(result["obj-server"]).toEqual({
      transport: "sse",
      url: "https://obj.example.com",
      headers: {},
    });
  });

  it("skips servers with empty url", () => {
    mockNormalized({ transport: "sse", url: "" });

    const result = getServerConfigs({
      mcp: { "bad-server": "https://example.com" },
    });

    expect(result).not.toHaveProperty("bad-server");
  });

  it("skips servers with whitespace-only url", () => {
    mockNormalized({ transport: "sse", url: "   " });

    const result = getServerConfigs({
      mcp: { "bad-server": "https://example.com" },
    });

    expect(result).not.toHaveProperty("bad-server");
  });

  it("trims url whitespace", () => {
    mockNormalized({ transport: "sse", url: "  https://trim.example.com  " });

    const result = getServerConfigs({
      mcp: { "trim-server": "https://example.com" },
    });

    expect(result["trim-server"]!.url).toBe("https://trim.example.com");
  });

  it("extracts bearer auth token", () => {
    mockNormalized({
      transport: "sse",
      url: "https://auth.example.com",
      auth: { type: "bearer", token: "my-token" },
    });

    const result = getServerConfigs({
      mcp: { "auth-server": "https://auth.example.com" },
    });

    expect(result["auth-server"]!.headers.authorization).toBe("Bearer my-token");
  });

  it("extracts headers auth", () => {
    mockNormalized({
      transport: "sse",
      url: "https://headers.example.com",
      auth: {
        type: "headers",
        headers: { "x-custom": "val1", "X-Dup": "val2" },
        headersEnv: {},
      },
    });

    const result = getServerConfigs({
      mcp: { "hdr-server": "https://headers.example.com" },
    });

    expect(result["hdr-server"]!.headers["x-custom"]).toBe("val1");
    expect(result["hdr-server"]!.headers["x-dup"]).toBe("val2");
  });

  it("handles servers without auth", () => {
    mockNormalized({
      transport: "sse",
      url: "https://noauth.example.com",
    });

    const result = getServerConfigs({
      mcp: { "no-auth-server": "https://noauth.example.com" },
    });

    expect(result["no-auth-server"]!.headers).toEqual({});
  });

  it("skips auth with skipAuth flag when bearer tokenEnv is missing", () => {
    mockNormalized({
      transport: "sse",
      url: "https://auth.example.com",
      auth: { type: "bearer", tokenEnv: "MISSING_VAR_XYZ" },
    });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = getServerConfigs({
      mcp: { "env-server": "https://auth.example.com" },
    });

    expect(result["env-server"]!.headers).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"MISSING_VAR_XYZ"'),
    );
    consoleWarnSpy.mockRestore();
  });

  it("skips auth with headers auth when headersEnv var is missing", () => {
    mockNormalized({
      transport: "sse",
      url: "https://headers.example.com",
      auth: {
        type: "headers",
        headers: { "x-api-key": "fallback" },
        headersEnv: { "x-api-key": "MISSING_HEADER_ENV" },
      },
    });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = getServerConfigs({
      mcp: { "hdr-env-server": "https://headers.example.com" },
    });

    expect(result["hdr-env-server"]!.headers).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"MISSING_HEADER_ENV"'),
    );
    consoleWarnSpy.mockRestore();
  });

  it("uses bearer token when provided directly (no env)", () => {
    mockNormalized({
      transport: "sse",
      url: "https://auth.example.com",
      auth: { type: "bearer", token: "secret-token" },
    });

    const result = getServerConfigs({
      mcp: { "token-server": "https://auth.example.com" },
    });

    expect(result["token-server"]!.headers.authorization).toBe("Bearer secret-token");
  });

  it("handles multiple servers", () => {
    mockNormalized({ transport: "sse", url: "https://one.example.com" });
    mockNormalized({ transport: "sse", url: "https://two.example.com" });

    const result = getServerConfigs({
      mcp: {
        "server-one": "https://one.example.com",
        "server-two": "https://two.example.com",
      },
    });

    expect(Object.keys(result)).toHaveLength(2);
    expect(result["server-one"]!.url).toBe("https://one.example.com");
    expect(result["server-two"]!.url).toBe("https://two.example.com");
  });

  it("preserves transport type from normalized", () => {
    mockNormalized({ transport: "stdio", url: "command" });

    const result = getServerConfigs({
      mcp: { "stdio-server": "command" },
    });

    expect(result["stdio-server"]!.transport).toBe("stdio");
  });
});

describe("McpServerConfigInput type", () => {
  it("validates shape", () => {
    const config: McpServerConfigInput = {
      transport: "sse",
      url: "https://example.com",
      headers: { authorization: "Bearer x" },
    };

    expect(config.transport).toBe("sse");
    expect(config.url).toBe("https://example.com");
    expect(config.headers.authorization).toBe("Bearer x");
  });

  it("allows stdio transport", () => {
    const config: McpServerConfigInput = {
      transport: "stdio",
      url: "some-command",
      headers: {},
    };

    expect(config.transport).toBe("stdio");
  });
});
