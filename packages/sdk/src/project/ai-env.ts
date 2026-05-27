import type { CloudflareModelId } from "@/cloudflare";

export interface KalpAIEnvironment {
  modelTiers?: Record<string, CloudflareModelId>;
}
