import type { CloudflareModelId } from "./models";

/**
 * Runtime/system model configuration.
 *
 * These are NOT user semantic tiers — they specify exact models for
 * internal runtime workloads like thread title generation, memory
 * summarization, routing decisions, etc.
 *
 * Each key maps directly to a model ID, bypassing tier resolution.
 */
export interface CloudflareSystemConfig {
  /**
   * Model used for auto-generating thread titles.
   * Default: "@cf/meta/llama-3.1-8b-instruct"
   */
  threadTitle?: CloudflareModelId;

  /**
   * Model used for memory summarization.
   * Default: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
   */
  memorySummarization?: CloudflareModelId;

  /**
   * Model used for trace/timeline summarization in Studio.
   * Default: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
   */
  traceSummarization?: CloudflareModelId;

  /**
   * Model used for routing decisions (intent classification, etc.).
   * Default: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
   */
  routing?: CloudflareModelId;
}

/**
 * Fallback model configuration per tier.
 * Used when a specific tier is requested but the primary model is unavailable.
 */
export interface CloudflareFallbackConfig {
  [tier: string]: CloudflareModelId | undefined;
}

/**
 * User-defined semantic model tiers.
 *
 * Each key is a developer-chosen tier name (e.g. "low", "high", "reasoning")
 * mapped to a Cloudflare model ID.
 *
 * Runtime workloads (thread title, memory summarization) go in `system`,
 * NOT here.
 */
export interface ModelTierMap {
  /**
   * Default/fast tier. Required.
   */
  low: CloudflareModelId;

  /**
   * High quality tier. Optional — falls back to `low` if not set.
   */
  high?: CloudflareModelId;

  /**
   * Tier for reasoning-heavy tasks (code, analysis, planning).
   */
  reasoning?: CloudflareModelId;

  /**
   * Tier for vision/image understanding tasks.
   */
  vision?: CloudflareModelId;

  /**
   * Tier for content moderation.
   */
  moderation?: CloudflareModelId;

  /**
   * Tier for structured data extraction.
   */
  extraction?: CloudflareModelId;

  /**
   * Tier for classification tasks.
   */
  classification?: CloudflareModelId;

  /**
   * Tier for code generation and analysis.
   */
  coding?: CloudflareModelId;

  /**
   * Tier for long-context tasks.
   */
  longContext?: CloudflareModelId;

  /**
   * Any custom tier name.
   */
  [key: string]: CloudflareModelId | undefined;
}

/**
 * Cloudflare AI configuration.
 *
 * This is the ONLY public AI provider abstraction in Kalp.
 * Provider concepts are hidden behind the cloudflare() config helper.
 */
export interface CloudflareAIConfig {
  /**
   * Cloudflare AI Gateway ID (optional).
   * Enables observability, caching, and rate limiting through the Gateway.
   */
  gatewayId?: string;

  /**
   * Cloudflare API Token with Workers AI permissions.
   * Can reference an env variable via `env("CLOUDFLARE_API_TOKEN")`.
   */
  apiKey?: string;

  /**
   * User-defined model tiers.
   * Maps semantic tier names → Cloudflare model IDs.
   */
  models: ModelTierMap;

  /**
   * Runtime/system model configuration.
   * Specifies exact models for internal workloads like thread title
   * generation, memory summarization, etc.
   * These are NOT user tiers — they bypass tier resolution.
   */
  system?: CloudflareSystemConfig;

  /**
   * Fallback models per tier.
   * Used when the primary model for a tier is unavailable.
   */
  fallback?: CloudflareFallbackConfig;
}
