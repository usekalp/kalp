/**
 * Project-level configuration module for Kalp.
 *
 * Defines global settings like secrets, identity providers,
 * and authentication enforcement policies.
 *
 * @module
 */

export type {
  KalpProjectConfig,
  McpServerInput,
  McpAuthInput,
  NormalizedMcpServer,
  McpServerRuntimeConfig,
} from "@/project/types";
export { env } from "@/project/types";
export { defineConfig } from "@/project/config";
export type { KalpAIEnvironment } from "@/project/ai-env";
export {
  normalizeMcpServer,
  collectMcpSecretRequirements,
  extractEnvName,
} from "@/project/normalize";

export type { CloudflareModelId } from "@/cloudflare/models";
