import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { ensureDir, writeFileIfNotExists, replacePlaceholders } from "./utils";

// Get version from package.json
const require = createRequire(import.meta.url);
const { version: CLI_VERSION } = require("../../package.json");

export interface ScaffoldProjectOptions {
  projectName: string;
  targetDir: string;
}

/**
 * Scaffolds a new Kalp project with configuration files.
 */
export async function scaffoldProject(opts: ScaffoldProjectOptions): Promise<void> {
  const { projectName, targetDir } = opts;

  await ensureDir(targetDir);
  await ensureDir(join(targetDir, "agents"));

  // Create .gitignore if it doesn't exist
  const gitignorePath = join(targetDir, ".gitignore");
  await writeFileIfNotExists(
    gitignorePath,
    "node_modules/\ndist/\n.turbo/\n.temp/\n.env\n*.log\n",
  );

  // Create version tracking
  const tempDir = join(targetDir, ".temp");
  await ensureDir(tempDir);

  const versionInfo = {
    cliVersion: CLI_VERSION,
    createdAt: new Date().toISOString(),
    projectName,
  };
  await writeFile(
    join(tempDir, "version.json"),
    JSON.stringify(versionInfo, null, 2),
    "utf-8",
  );

  // Create kalp.config.ts with Clerk identity example
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
  await writeFile(join(targetDir, "kalp.config.ts"), kalpConfig, "utf-8");
}
