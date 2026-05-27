import type { CloudflareAIConfig } from "./types";

export function cloudflare<T extends CloudflareAIConfig>(config: T): T {
  return config;
}
