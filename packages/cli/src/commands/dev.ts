import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";
import open from "open";
import { ensureSecretKey } from "@/utils/secret";
import { createStudioToken } from "@/utils/studio-token";

const LOGO = "🦋";
const WRANGLER_CONFIG = "packages/cloudflare/wrangler.jsonc";

export default defineCommand({
  meta: { name: "dev", description: "Run Worker + Studio local environment" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp dev")}`);

    const { key } = await ensureSecretKey(cwd);
    await copyFile(join(cwd, ".env"), join(cwd, ".dev.vars"));
    const token = await createStudioToken(key);

    p.note("Starting backend (wrangler dev :8787) and frontend (Vite :5173)");

    const backend = execa(
      "npx",
      ["wrangler", "dev", "--port", "8787", "--config", WRANGLER_CONFIG],
      { cwd, stdio: "inherit" },
    );

    const frontend = execa("pnpm", ["--filter=@kalphq/studio", "dev"], {
      cwd,
      stdio: "inherit",
    });

    const shutdown = () => {
      backend.kill("SIGINT");
      frontend.kill("SIGINT");
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await delay(2500);
    const studioUrl = `http://localhost:5173/studio/?token=${token}`;
    await open(studioUrl);
    p.log.success(`Studio opened at ${pc.cyan(studioUrl)}`);

    try {
      await Promise.race([backend, frontend]);
    } finally {
      shutdown();
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
    }
  },
});
