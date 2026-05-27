import { writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureDir,
  writeFileIfNotExists,
  replacePlaceholders,
  copyDir,
} from "./utils";
import pkg from "../../package.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_ROOT = resolve(__dirname, "..", "templates");

const CLI_VERSION = pkg.version;

export interface ScaffoldProjectOptions {
  projectName: string;
  targetDir: string;
}

export async function scaffoldProject(
  opts: ScaffoldProjectOptions,
): Promise<void> {
  const { projectName, targetDir } = opts;

  const projectTemplateDir = join(TEMPLATES_ROOT, "project");

  await copyDir(projectTemplateDir, targetDir);

  const gitignorePath = join(targetDir, "gitignore");
  try {
    await rename(gitignorePath, join(targetDir, ".gitignore"));
  } catch {
  }

  await replacePlaceholders(targetDir, {
    __PROJECT_NAME__: projectName,
    __CLI_VERSION__: CLI_VERSION,
  });

  const tempDir = join(targetDir, ".temp");
  await ensureDir(tempDir);

  const kalpConfig = `import { defineConfig, cloudflare, UserId } from "@kalphq/sdk";

export default defineConfig({
  secrets: [],

  ai: cloudflare({
    models: {
      low: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      high: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      reasoning: "@cf/deepseek/deepseek-r1-distill-qwen-32b",
      vision: "@cf/meta/llama-3.2-11b-vision-instruct",
      moderation: "@cf/meta/llama-guard-3-8b",
      extraction: "@cf/meta/llama-3.1-8b-instruct",
      classification: "@cf/meta/llama-3.1-8b-instruct",
      coding: "@cf/deepseek/deepseek-coder-6.7b-instruct",
      longContext: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    },
  }),

  identity: {
    id: "clerk",
    strategy: {
      type: "jwks",
      jwksUrl: "https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json",
    },
    mapIdentity: (payload, headers) => {
      if (headers?.["x-bot-key"]) {
        return {
          userId: "service-bot-001" as UserId,
          claims: { role: "service", bot: true },
        };
      }

      return {
        userId: payload.sub as UserId,
        email: payload.email as string,
        name: payload.name as string | undefined,
        claims: {
          role: payload.role || "user",
          orgId: payload.org_id,
        },
      };
    },
  },

  enforceGlobalAuth: true,
});
`;
  await writeFileIfNotExists(join(targetDir, "kalp.config.ts"), kalpConfig);

  const kalpGeneratedDir = join(targetDir, ".kalp", "generated");
  await ensureDir(kalpGeneratedDir);
  const generatedTypes = `// \u{1F98B} Kalp Generated Types
// This file is auto-generated. Do not edit manually.
/**
 * Registered secrets from kalp.config.ts
 * @generated
 */
export type RegisteredSecretKeys = readonly [];

/**
 * AI model tier keys resolved from cloudflare config
 * @generated
 */
export type ConfiguredAIModelTiers = readonly ["low", "high", "reasoning", "vision", "moderation", "extraction", "classification", "coding", "longContext"];

declare module "@kalphq/sdk" {
  interface SecretsRegistry {
    keys: RegisteredSecretKeys;
  }

  interface KalpAITierNames {
    [key in ConfiguredAIModelTiers[number]]: true;
  }
}
`;
  await writeFileIfNotExists(
    join(kalpGeneratedDir, "project.d.ts"),
    generatedTypes,
  );

  const secretKey = randomBytes(32).toString("hex");
  const studioPassword = randomBytes(24).toString("base64url");
  const serviceKey = `kalp_sk_live_${randomBytes(32).toString("base64url")}`;
  const envContent = `# Secret key used to encrypt Studio session cookies and sign auth tokens.
# Auto-generated during scaffolding. Keep this value secret.
KALP_SECRET_KEY=${secretKey}

# Password for the Studio admin account used to log into the dashboard.
# Combine with KALP_STUDIO_ADMIN_USER to authenticate.
KALP_STUDIO_PASSWORD=${studioPassword}

# Admin username for Studio dashboard login.
KALP_STUDIO_ADMIN_USER=admin

# Service key used for server-to-server API authentication.
# Required when making authenticated requests between Kalp services.
KALP_SERVICE_KEY=${serviceKey}
`;

  await writeFileIfNotExists(join(targetDir, ".env"), envContent);
  await writeFileIfNotExists(join(targetDir, ".dev.vars"), envContent);
}
