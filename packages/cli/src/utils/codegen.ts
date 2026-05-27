import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadProjectConfig } from "@/utils/project-config";
import type { ProjectGenerator, GeneratorResult } from "./sync";

const GENERATED_HEADER = "// \u{1F98B} Kalp Generated Types\n// This file is auto-generated. Do not edit manually.\n";

interface GeneratedTypeConfig {
  secrets: string[];
  modelTierKeys: string[];
}

function sanitizeSecrets(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function sanitizeModelTierKeys(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  const keys = Object.keys(input as Record<string, unknown>);
  return keys
    .map((k) => k.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

async function readConfigForTypes(cwd: string): Promise<GeneratedTypeConfig> {
  const { raw } = await loadProjectConfig(cwd);
  const aiConfig =
    raw.ai && typeof raw.ai === "object"
      ? (raw.ai as Record<string, unknown>)
      : {};

  const models = aiConfig.models;

  return {
    secrets: sanitizeSecrets(raw.secrets),
    modelTierKeys: sanitizeModelTierKeys(models),
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
 * AI model tier keys resolved from cloudflare config
 * @generated
 */
export type ConfiguredAIModelTiers = ${toStringTuple(config.modelTierKeys)};

declare module "@kalphq/sdk" {
  interface SecretsRegistry {
    keys: RegisteredSecretKeys;
  }

  interface KalpAITierRegistry {
    keys: ConfiguredAIModelTiers;
  }
}
`;
}

export class ProjectTypesGenerator implements ProjectGenerator {
  id = "project";
  name = "Project Types";

  async generate(cwd: string): Promise<GeneratorResult> {
    const generatedDir = join(cwd, ".kalp", "generated");
    const typesPath = join(generatedDir, "project.d.ts");

    await mkdir(generatedDir, { recursive: true });

    const config = await readConfigForTypes(cwd);
    const content = buildKalpGeneratedTypes(config);

    const existing = await readFile(typesPath, "utf-8").catch(() => null);
    if (existing === content) {
      return { updated: false };
    }

    await writeFile(typesPath, content, "utf-8");
    return { updated: true };
  }
}

export async function generateTypes(cwd: string): Promise<void> {
  const gen = new ProjectTypesGenerator();
  await gen.generate(cwd);
}
