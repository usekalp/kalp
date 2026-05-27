// 🦋 Auto-generated Cloudflare Models Registry
// Source: https://developers.cloudflare.com/workers-ai/models/
// Last synced: 2026-05-27
// DO NOT EDIT MANUALLY — run `pnpm sync:models` to regenerate.

// ── Full Catalog (all known Workers AI models) ──────────────────────────────

export type CloudflareModelId =
  // ── Meta Llama ──────────────────────────────────────────────────────
  | "@cf/meta/llama-3.1-8b-instruct"
  | "@cf/meta/llama-3.1-70b-instruct"
  | "@cf/meta/llama-3.1-405b-instruct"
  | "@cf/meta/llama-3.2-3b-instruct"
  | "@cf/meta/llama-3.2-11b-vision-instruct"
  | "@cf/meta/llama-3.3-70b-instruct-multilingual"
  | "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
  | "@cf/meta/llama-guard-3-8b"
  // ── Anthropic (via AI Gateway) ───────────────────────────────────────
  | "@cf/anthropic/claude-3.5-haiku"
  | "@cf/anthropic/claude-3.5-sonnet"
  | "@cf/anthropic/claude-3.7-sonnet"
  | "@cf/anthropic/claude-opus-4.5"
  // ── OpenAI (via AI Gateway) ──────────────────────────────────────────
  | "@cf/openai/gpt-4o"
  | "@cf/openai/gpt-4o-mini"
  | "@cf/openai/o3-mini"
  | "@cf/openai/o4-mini"
  // ── Mistral ──────────────────────────────────────────────────────────
  | "@cf/mistral/mistral-7b-instruct-v0.3"
  | "@cf/mistral/mistral-large-latest"
  | "@cf/mistral/mistral-small-latest"
  // ── Microsoft Phi ────────────────────────────────────────────────────
  | "@cf/microsoft/phi-3-mini-4k-instruct"
  | "@cf/microsoft/phi-3-medium-4k-instruct"
  // ── Qwen ─────────────────────────────────────────────────────────────
  | "@cf/qwen/qwen2-7b-instruct"
  | "@cf/qwen/qwen2-72b-instruct"
  // ── Google Gemma ─────────────────────────────────────────────────────
  | "@cf/google/gemma-2-9b-it"
  | "@cf/google/gemma-2-27b-it"
  // ── DeepSeek ─────────────────────────────────────────────────────────
  | "@cf/deepseek/deepseek-r1-distill-qwen-32b"
  | "@cf/deepseek/deepseek-r1-distill-llama-70b"
  // ── Intel ────────────────────────────────────────────────────────────
  | "@cf/intel/neural-chat-7b-v3-1"
  // ── Embeddings & Rerank ──────────────────────────────────────────────
  | "@cf/baai/bge-base-en-v1.5"
  | "@cf/baai/bge-reranker-large"
  // ── Forward-compatible catch-all ─────────────────────────────────────
  | (string & {});

// ── Recommended Subset (curated for quality & speed) ────────────────────────

export type CloudflareRecommendedModelId =
  | "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
  | "@cf/meta/llama-3.1-8b-instruct"
  | "@cf/meta/llama-3.1-70b-instruct"
  | "@cf/mistral/mistral-large-latest"
  | "@cf/mistral/mistral-small-latest"
  | "@cf/anthropic/claude-3.5-haiku"
  | "@cf/anthropic/claude-3.5-sonnet"
  | "@cf/openai/gpt-4o-mini"
  | "@cf/openai/gpt-4o"
  | "@cf/google/gemma-2-9b-it";

// ── Recommended Tier Defaults (used by create-kalp scaffold) ────────────────

export const RECOMMENDED_MODELS: Record<string, CloudflareRecommendedModelId> = {
  fast: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  balanced: "@cf/meta/llama-3.1-8b-instruct",
  powerful: "@cf/mistral/mistral-large-latest",
} as const;
