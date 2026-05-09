import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import open from "open";

const LOGO = "🦋";

/**
 * Generate KALP_SECRET_KEY if not exists.
 * Returns the key and whether it was newly created.
 */
async function ensureSecretKey(cwd: string): Promise<{ key: string, isNew: boolean }> {
  const envPath = join(cwd, ".env");
  
  try {
    const envContent = await readFile(envPath, "utf-8");
    const match = envContent.match(/^KALP_SECRET_KEY=(.+)$/m);
    if (match && match[1]) {
      return { key: match[1].trim(), isNew: false };
    }
  } catch {
    // .env doesn't exist, create it
  }

  // Generate new secret
  const secretKey = randomBytes(32).toString("hex");
  const envContent = `# Kalp Studio Authentication Secret
KALP_SECRET_KEY=${secretKey}
`;
  
  await writeFile(envPath, envContent, "utf-8");
  return { key: secretKey, isNew: true };
}

/**
 * Read worker URL from .kalp/state.json.
 */
async function readWorkerUrl(cwd: string): Promise<string | null> {
  try {
    const statePath = join(cwd, ".kalp", "state.json");
    const content = await readFile(statePath, "utf-8");
    const state = JSON.parse(content);
    return state.workerUrl || null;
  } catch {
    return null;
  }
}

export default defineCommand({
  meta: { name: "studio", description: "Open Kalp Studio in browser" },
  args: {
    url: {
      type: "string",
      alias: "u",
      description: "Worker URL (overrides saved state)",
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    
    p.intro(`${LOGO} ${pc.bold("kalp studio")}`);

    // 1. Ensure KALP_SECRET_KEY exists
    const s = p.spinner();
    s.start("Checking authentication secret");
    
    const { key: secretKey, isNew: isNewSecret } = await ensureSecretKey(cwd);
    
    s.stop("Authentication secret ready");

    if (isNewSecret) {
      p.log.warning(
        "No KALP_SECRET_KEY found. Generated a new one in .env"
      );
      p.note(
        "Please run 'kalp push' to sync the new secret with Cloudflare",
        "Action Required"
      );
    }

    // 2. Get worker URL
    const workerUrl = args.url || (await readWorkerUrl(cwd));
    
    if (!workerUrl) {
      p.log.error(
        "No worker URL found. Run 'kalp push' first or use --url flag"
      );
      process.exit(1);
    }

    // 3. Generate JWT (1 hour expiry)
    s.start("Generating authentication token");
    
    const secret = new TextEncoder().encode(secretKey);
    const token = await new SignJWT({
      sub: "cli-user",
      aud: "kalp-studio",
      iat: Date.now(),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
    
    s.stop("Token generated");

    // 4. Open browser
    const studioUrl = `${workerUrl}/studio?token=${token}`;
    p.log.info(`Opening Studio at ${pc.cyan(studioUrl)}`);
    
    await open(studioUrl);
    
    p.outro(`${LOGO} ${pc.green("Studio opened")}`);
  },
});
