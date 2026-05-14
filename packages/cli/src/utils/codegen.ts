import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadProjectConfig } from "@/utils/project-config";
import type { ProjectGenerator, GeneratorResult } from "./sync";

const GENERATED_HEADER = `// 🦋 Kalp Generated Types
// This file is auto-generated. Do not edit manually.
`;

type AIProvider = string;

interface GeneratedTypeConfig {
  secrets: string[];
  provider: AIProvider;
  customModels: string[];
}

const DEFAULT_PROVIDER: AIProvider = "openai";

function sanitizeSecrets(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function sanitizeCustomModels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function sanitizeProvider(input: unknown): string {
  if (typeof input === "string" && input.trim()) {
    return input.trim();
  }
  return DEFAULT_PROVIDER;
}

async function readConfigForTypes(cwd: string): Promise<GeneratedTypeConfig> {
  const { raw } = await loadProjectConfig(cwd);
  const aiConfig =
    raw.ai && typeof raw.ai === "object"
      ? (raw.ai as Record<string, unknown>)
      : {};

  return {
    secrets: sanitizeSecrets(raw.secrets),
    provider: sanitizeProvider(aiConfig.provider),
    customModels: sanitizeCustomModels(aiConfig.customModels),
  };
}

function toStringTuple(values: string[]): string {
  if (values.length === 0) return "readonly []";
  return `readonly [${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function buildKalpGeneratedTypes(config: GeneratedTypeConfig): string {
  return `${GENERATED_HEADER}import "@kalphq/sdk";

/**
 * Registered secrets from kalp.config.ts
 * @generated
 */
export type RegisteredSecretKeys = ${toStringTuple(config.secrets)};

/**
 * AI provider resolved from kalp.config.ts
 * @generated
 */
export type ConfiguredAIProvider = ${JSON.stringify(config.provider)};

/**
 * Custom model suggestions resolved from kalp.config.ts
 * @generated
 */
export type ConfiguredAICustomModels = ${toStringTuple(config.customModels)};

declare module "@kalphq/sdk" {
  interface SecretsRegistry {
    keys: RegisteredSecretKeys;
  }

  interface KalpAIEnvironment {
    provider: ConfiguredAIProvider;
    customModels: ConfiguredAICustomModels;
  }
}
`;
}

/**
 * Generator for core project types (AI, Secrets, Models).
 */
export class ProjectTypesGenerator implements ProjectGenerator {
  id = "project";
  name = "Project Types";

  async generate(cwd: string): Promise<GeneratorResult> {
    const generatedDir = join(cwd, ".kalp", "generated");
    const typesPath = join(generatedDir, "project.d.ts");

    await mkdir(generatedDir, { recursive: true });

    const config = await readConfigForTypes(cwd);
    const content = buildKalpGeneratedTypes(config);

    // Check if update is needed
    const existing = await readFile(typesPath, "utf-8").catch(() => null);
    if (existing === content) {
      return { updated: false };
    }

    await writeFile(typesPath, content, "utf-8");
    return { updated: true };
  }
}

/**
 * Legacy export for backward compatibility during refactor.
 * @deprecated Use ProjectSynchronizer instead.
 */
export async function generateTypes(cwd: string): Promise<void> {
  const gen = new ProjectTypesGenerator();
  await gen.generate(cwd);
}
