const MCP_CLIENT_NAME = "kalp";
const MCP_PROTOCOL_VERSION = "2025-06-18";

export interface McpTransportConfig {
  url: string;
  headers?: Record<string, string>;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id?: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface McpToolContent {
  type: string;
  text?: string;
  data?: unknown;
}

export interface McpToolCallResult {
  content: McpToolContent[];
  isError?: boolean;
}

export interface McpToolDefinition {
  name: string;
  inputSchema?: unknown;
}

export class McpTransport {
  private config: McpTransportConfig;
  private sessionId: string | null = null;
  private protocolVersion: string = MCP_PROTOCOL_VERSION;
  private connected = false;

  constructor(config: McpTransportConfig) {
    this.config = config;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const initResult = await this.postJsonRpc<{ protocolVersion?: string }>(
      "initialize",
      {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: MCP_CLIENT_NAME, version: "1.0.0" },
      },
    );

    this.protocolVersion =
      typeof initResult.protocolVersion === "string"
        ? initResult.protocolVersion
        : MCP_PROTOCOL_VERSION;

    await this.postJsonRpc("notifications/initialized", undefined).catch(() => {});

    this.connected = true;
  }

  async callTool(toolName: string, args?: unknown): Promise<McpToolCallResult> {
    await this.ensureConnected();

    const params: Record<string, unknown> = { name: toolName };
    if (args !== undefined) {
      params.arguments = args;
    }

    return this.postJsonRpc<McpToolCallResult>("tools/call", params);
  }

  async listTools(): Promise<McpToolDefinition[]> {
    await this.ensureConnected();
    const result = await this.postJsonRpc<{ tools: McpToolDefinition[] }>(
      "tools/list",
      {},
    );
    return result.tools ?? [];
  }

  async disconnect(): Promise<void> {
    this.sessionId = null;
    this.connected = false;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  private async postJsonRpc<T>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const body: Record<string, unknown> = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
    };
    if (params !== undefined) {
      body.params = params;
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": this.protocolVersion,
      ...this.config.headers,
    };

    if (this.sessionId) {
      headers["MCP-Session-Id"] = this.sessionId;
    }

    const response = await fetch(this.config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `MCP request failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    const sessionHeader = response.headers.get("mcp-session-id");
    if (sessionHeader) {
      this.sessionId = sessionHeader;
    }

    let jsonText = text;
    if (text.includes("event: message") && text.includes("data: {")) {
      const lines = text.split(/\r?\n/);

      if (!sessionHeader) {
        const idLine = lines.find((line) => line.startsWith("id: "));
        if (idLine) {
          const capturedId = idLine.slice(4).trim();
          if (capturedId) {
            this.sessionId = capturedId;
          }
        }
      }

      const dataLine = lines.find((line) => line.startsWith("data: "));
      if (dataLine) {
        jsonText = dataLine.slice(6).trim();
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(`Invalid JSON-RPC response: ${text.slice(0, 300)}`);
    }

    const resp = parsed as JsonRpcResponse<T>;
    if (resp.error) {
      throw new Error(
        `MCP error (${resp.error.code}): ${resp.error.message}`,
      );
    }

    return resp.result as T;
  }
}
