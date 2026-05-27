/**
 * 🦋 Cloudflare Models Sync Script
 *
 * Fetches the latest Workers AI model catalog from Cloudflare's API
 * and regenerates `src/cloudflare/models-generated.ts`.
 *
 * This runs during SDK prepublish, NOT during scaffolding or runtime.
 * The generated file is published inside @kalphq/sdk for offline use.
 *
 * Usage: pnpm sync:models
 *
 * Requirements:
 *   - CLOUDFLARE_API_TOKEN env var (optional — falls back to static catalog)
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TARGET = resolve(__dirname, "..", "src", "cloudflare", "models-generated.ts");

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4/accounts";
const SYNC_DATE = new Date().toISOString().slice(0, 10);

interface CfModel {
  name: string;
  description?: string;
  type?: string;
}

async function fetchModelsFromApi(): Promise<CfModel[]> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not set");

  // Fetch account ID from token
  const userRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const userData = (await userRes.json()) as { result?: { id: string } };
  const accountId = userData.result?.id;
  if (!accountId) throw new Error("Could not verify Cloudflare token");

  const res = await fetch(`${CLOUDFLARE_API}/${accountId}/ai/models/search?per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { result?: CfModel[] };
  return data.result ?? [];
}

// ── Static fallback catalog ─────────────────────────────────────────────────
// Used when CLOUDFLARE_API_TOKEN is not set during development.
// Keep this in sync with the latest Workers AI catalog.

const STATIC_CATALOG: CfModel[] = [
  { name: "@cf/meta/llama-3.1-8b-instruct", type: "text-generation" },
  { name: "@cf/meta/llama-3.1-70b-instruct", type: "text-generation" },
  { name: "@cf/meta/llama-3.1-405b-instruct", type: "text-generation" },
  { name: "@cf/meta/llama-3.2-3b-instruct", type: "text-generation" },
  { name: "@cf/meta/llama-3.2-11b-vision-instruct", type: "text-generation" },
  { name: "@cf/meta/llama-3.3-70b-instruct-multilingual", type: "text-generation" },
  { name: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", type: "text-generation" },
  { name: "@cf/meta/llama-guard-3-8b", type: "text-generation" },
  { name: "@cf/mistral/mistral-7b-instruct-v0.3", type: "text-generation" },
  { name: "@cf/mistral/mistral-large-latest", type: "text-generation" },
  { name: "@cf/mistral/mistral-small-latest", type: "text-generation" },
  { name: "@cf/microsoft/phi-3-mini-4k-instruct", type: "text-generation" },
  { name: "@cf/microsoft/phi-3-medium-4k-instruct", type: "text-generation" },
  { name: "@cf/qwen/qwen2-7b-instruct", type: "text-generation" },
  { name: "@cf/qwen/qwen2-72b-instruct", type: "text-generation" },
  { name: "@cf/google/gemma-2-9b-it", type: "text-generation" },
  { name: "@cf/google/gemma-2-27b-it", type: "text-generation" },
  { name: "@cf/deepseek/deepseek-r1-distill-qwen-32b", type: "text-generation" },
  { name: "@cf/deepseek/deepseek-r1-distill-llama-70b", type: "text-generation" },
  { name: "@cf/intel/neural-chat-7b-v3-1", type: "text-generation" },
  { name: "@cf/baai/bge-base-en-v1.5", type: "embeddings" },
  { name: "@cf/baai/bge-reranker-large", type: "rerank" },
];

const GATEWAY_MODELS: CfModel[] = [
  { name: "@cf/anthropic/claude-3.5-haiku", type: "text-generation" },
  { name: "@cf/anthropic/claude-3.5-sonnet", type: "text-generation" },
  { name: "@cf/anthropic/claude-3.7-sonnet", type: "text-generation" },
  { name: "@cf/anthropic/claude-opus-4.5", type: "text-generation" },
  { name: "@cf/openai/gpt-4o", type: "text-generation" },
  { name: "@cf/openai/gpt-4o-mini", type: "text-generation" },
  { name: "@cf/openai/o3-mini", type: "text-generation" },
  { name: "@cf/openai/o4-mini", type: "text-generation" },
];

const RECOMMENDED: string[] = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.1-70b-instruct",
  "@cf/mistral/mistral-large-latest",
  "@cf/mistral/mistral-small-latest",
  "@cf/anthropic/claude-3.5-haiku",
  "@cf/anthropic/claude-3.5-sonnet",
  "@cf/openai/gpt-4o-mini",
  "@cf/openai/gpt-4o",
  "@cf/google/gemma-2-9b-it",
];

async function main() {
  let workersModels: CfModel[];
  try {
    workersModels = await fetchModelsFromApi();
    console.log(`✓ Fetched ${workersModels.length} models from Cloudflare API`);
  } catch (err) {
    workersModels = STATIC_CATALOG;
    console.warn(`⚠ Using static catalog (${err})`);
  }

  const allModels = [...workersModels, ...GATEWAY_MODELS];
  const textModels = allModels.filter(
    (m) => !m.type || m.type === "text-generation",
  );
  const sorted = [...new Set(textModels.map((m) => m.name))].sort();

  const modelUnion = sorted.map((name) => `  | ${JSON.stringify(name)}`).join("\n");

  const recommendedUnion = RECOMMENDED.map((name) => `  | ${JSON.stringify(name)}`).join("\n");

  const recommendedPairs = RECOMMENDED.slice(0, 3).map((name) => {
    const key = name.includes("fp8") ? "fast" : name.includes("8b") ? "balanced" : "powerful";
    return `  ${key}: ${JSON.stringify(name)}`;
  }).join(",\n");

  const content = `// 🦋 Auto-generated Cloudflare Models Registry
// Source: https://developers.cloudflare.com/workers-ai/models/
// Last synced: ${SYNC_DATE}
// DO NOT EDIT MANUALLY — run \`pnpm sync:models\` to regenerate.

// ── Full Catalog (all known Workers AI models) ──────────────────────────────

export type CloudflareModelId =
${modelUnion}
  // ── Forward-compatible catch-all ─────────────────────────────────────
  | (string & {});

// ── Recommended Subset (curated for quality & speed) ────────────────────────

export type CloudflareRecommendedModelId =
${recommendedUnion};

// ── Recommended Tier Defaults (used by create-kalp scaffold) ────────────────

export const RECOMMENDED_MODELS: Record<string, CloudflareRecommendedModelId> = {
${recommendedPairs},
} as const;
`;

  writeFileSync(TARGET, content, "utf-8");
  console.log(`✓ Wrote ${sorted.length} models to ${TARGET}`);
}

main().catch((err) => {
  console.error("✗ Sync failed:", err.message);
  process.exit(1);
});
