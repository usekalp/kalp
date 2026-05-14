import {
  ENV_MARKER_PREFIX,
  ENV_MARKER_SUFFIX,
  type McpAuthInput,
  type McpServerInput,
  type NormalizedMcpServer,
  type KalpProjectConfig,
} from "./types";

/**
 * Extracts the environment variable name from a marker string.
 */
export function extractEnvName(val: string): string | null {
  if (
    typeof val === "string" &&
    val.startsWith(ENV_MARKER_PREFIX) &&
    val.endsWith(ENV_MARKER_SUFFIX)
  ) {
    return val.slice(ENV_MARKER_PREFIX.length, -ENV_MARKER_SUFFIX.length);
  }
  return null;
}

/**
 * Normalizes a value that might be an environment variable reference.
 */
function normalizeEnvValue(val: string): { value?: string; envName?: string } {
  const envName = extractEnvName(val);
  if (envName) {
    return {
      envName,
      value: typeof process !== "undefined" ? process.env[envName] : undefined,
    };
  }
  return { value: val };
}

/**
 * Converts a user-provided MCP configuration into a strict internal shape.
 */
export function normalizeMcpServer(input: McpServerInput): NormalizedMcpServer {
  if (typeof input === "string") {
    return {
      url: input,
      transport: "sse",
    };
  }

  const transport = input.transport || "sse";
  const url = input.url;

  if (!input.auth) {
    return { url, transport };
  }

  let auth: NormalizedMcpServer["auth"];

  if (typeof input.auth === "string") {
    const { value, envName } = normalizeEnvValue(input.auth);
    auth = {
      type: "bearer",
      token: value,
      tokenEnv: envName,
    };
  } else if (input.auth.type === "bearer") {
    const { value, envName } = normalizeEnvValue(input.auth.token);
    auth = {
      type: "bearer",
      token: value,
      tokenEnv: envName,
    };
  } else if (input.auth.type === "headers") {
    const headers: Record<string, string> = {};
    const headersEnv: Record<string, string> = {};

    for (const [key, val] of Object.entries(input.auth.headers)) {
      const { value, envName } = normalizeEnvValue(val || "");
      if (value !== undefined) headers[key] = value;
      if (envName) headersEnv[key] = envName;
    }

    auth = {
      type: "headers",
      headers,
      headersEnv,
    };
  }

  return { url, transport, auth };
}

/**
 * Collects all environment variables required by the project's MCP configuration.
 */
export function collectMcpSecretRequirements(config: KalpProjectConfig): string[] {
  if (!config.mcp) return [];

  const secrets = new Set<string>();

  for (const serverInput of Object.values(config.mcp)) {
    const normalized = normalizeMcpServer(serverInput);
    if (!normalized.auth) continue;

    if (normalized.auth.type === "bearer") {
      if (normalized.auth.tokenEnv) {
        secrets.add(normalized.auth.tokenEnv);
      }
    } else if (normalized.auth.type === "headers") {
      for (const envName of Object.values(normalized.auth.headersEnv)) {
        secrets.add(envName);
      }
    }
  }

  return Array.from(secrets).sort();
}
