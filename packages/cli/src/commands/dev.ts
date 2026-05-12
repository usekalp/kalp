import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";
import open from "open";
import { ensureSecretKey } from "@/utils/secret";
import { materializeRuntime } from "@/utils/runtime";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "dev", description: "Run Worker + Studio local environment" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp dev")}`);

    await ensureSecretKey(cwd);
    await copyFile(join(cwd, ".env"), join(cwd, ".dev.vars"));
    const runtime = await materializeRuntime(cwd, { mode: "local" });

    p.note("Starting local runtime (wrangler dev :8787)");

    const backend = execa(
      "npx",
      [
        "wrangler",
        "dev",
        "--port",
        "8787",
        "--config",
        runtime.wranglerConfigPath,
      ],
      { cwd, stdio: "inherit" },
    );

    const shutdown = () => {
      backend.kill("SIGINT");
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await delay(2500);
    const studioUrl = "http://localhost:8787/studio/login";
    await open(studioUrl);
    p.log.success(`Studio opened at ${pc.cyan(studioUrl)}`);

    try {
      await backend;
    } finally {
      shutdown();
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
    }
  },
});
