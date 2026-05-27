export const MCP_CLIENT_NAME = "kalp-cli";
export const MCP_PROTOCOL_VERSION = "2025-06-18";

export interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id?: string | number;
  result: T;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id?: string | number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function createRpcPayload(
  id: number | string,
  method: string,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  if (params) {
    return {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    method,
  };
}

const MCP_SESSIONS = new Map<string, string>();

export async function postJsonRpc<T>(
  url: string,
  body: Record<string, unknown>,
  protocolVersion: string,
  extraHeaders: Record<string, string> = {},
): Promise<JsonRpcResponse<T>> {
  const headers: Record<string, string> = {
    ...extraHeaders,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": protocolVersion,
  };

  const sessionId = MCP_SESSIONS.get(url);
  if (sessionId) {
    headers["MCP-Session-Id"] = sessionId;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const sessionHeader = response.headers.get("mcp-session-id");
  if (sessionHeader) {
    MCP_SESSIONS.set(url, sessionHeader);
  }

  let jsonText = text;

  if (text.includes("event: message") && text.includes("data: {")) {
    const lines = text.split(/\r?\n/);

    if (!sessionHeader) {
      const idLine = lines.find((line) => line.startsWith("id: "));
      if (idLine) {
        const capturedId = idLine.slice(4).trim();
        if (capturedId) {
          MCP_SESSIONS.set(url, capturedId);
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
    throw new Error(`Invalid JSON-RPC response payload: ${text.slice(0, 300)}`);
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new Error("Invalid JSON-RPC response shape.");
  }

  return record as unknown as JsonRpcResponse<T>;
}

export async function initializeServer(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  const initResponse = await postJsonRpc<{ protocolVersion?: string }>(
    url,
    createRpcPayload(1, "initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: MCP_CLIENT_NAME, version: "0.1.0" },
    }),
    MCP_PROTOCOL_VERSION,
    headers,
  );

  if ("error" in initResponse) {
    throw new Error(
      `initialize failed (${initResponse.error.code}): ${initResponse.error.message}`,
    );
  }

  const negotiatedVersion =
    typeof initResponse.result?.protocolVersion === "string"
      ? initResponse.result.protocolVersion
      : MCP_PROTOCOL_VERSION;

  await postJsonRpc(
    url,
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
    negotiatedVersion,
    headers,
  ).catch(() => {
  });

  return negotiatedVersion;
}
