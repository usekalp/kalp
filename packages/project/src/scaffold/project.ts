import { writeFile, rename } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, writeFileIfNotExists, replacePlaceholders, copyDir } from "./utils";
import pkg from "../../package.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// dist/index.js -> templates is at ../templates
const TEMPLATES_ROOT = resolve(__dirname, "..", "templates");

// Get version from bundled package.json
const CLI_VERSION = pkg.version;

export interface ScaffoldProjectOptions {
  projectName: string;
  targetDir: string;
}

/**
 * Scaffolds a new Kalp project with configuration files.
 */
export async function scaffoldProject(opts: ScaffoldProjectOptions): Promise<void> {
  const { projectName, targetDir } = opts;

  const projectTemplateDir = join(TEMPLATES_ROOT, "project");

  // Copy template files
  await copyDir(projectTemplateDir, targetDir);

  // Handle gitignore renaming (npm ignores .gitignore, so we store it as gitignore in templates)
  const gitignorePath = join(targetDir, "gitignore");
  try {
    await rename(gitignorePath, join(targetDir, ".gitignore"));
  } catch {
    // Ignore if template didn't have it
  }

  // Replace placeholders in the entire project
  await replacePlaceholders(targetDir, {
    __PROJECT_NAME__: projectName,
    __CLI_VERSION__: CLI_VERSION,
  });

  // Create .temp for version tracking (if not in template)
  const tempDir = join(targetDir, ".temp");
  await ensureDir(tempDir);

  // kalp.config.ts is usually not in template to allow better customization
  const kalpConfig = `import { defineConfig, UserId } from "@kalphq/sdk";

export default defineConfig({
  secrets: ["OPENAI_API_KEY"],

  // Clerk authentication example (optional)
  // Remove or replace with your own identity provider
  identity: {
    id: "clerk",
    strategy: {
      type: "jwks",
      jwksUrl: "https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json",
    },
    mapIdentity: (payload, headers) => {
      // Handle both JWT users and API key bots
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
}
