import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { setTimeout as delay } from "node:timers/promises";
import open from "open";
import { createRuntime } from "@/runtime/create-runtime";

const LOGO = "🦋";
const STUDIO_ORIGIN = "http://localhost:8787";

export default defineCommand({
  meta: { name: "dev", description: "Run Worker + Studio local environment" },
  async run() {
    p.intro(`${LOGO} ${pc.bold("kalp dev")}`);

    try {
      const runtime = await createRuntime({
        cwd: process.cwd(),
        port: 8787,
        ui: {
          note: (msg, title) => p.note(msg, title),
          startSpinner: (text) => {
            const s = p.spinner();
            s.start(text);
            return { stop: (t) => s.stop(t) };
          },
          logInfo: (t) => p.log.info(t),
          logError: (t) => p.log.error(t),
          logSuccess: (t) => p.log.success(t),
        },
      });

      // Bootstrap: generateTypes, compile agents, start Miniflare
      await runtime.start();

      // Show boot completion
      const bootSpinner = p.spinner();
      bootSpinner.start("Starting development server...");
      await delay(1800);
      bootSpinner.stop("Development server is running at http://localhost:8787");

      const studioUrl = `${STUDIO_ORIGIN}/studio/login`;
      await open(studioUrl);
      p.log.success(`Studio available at ${pc.cyan(studioUrl)}`);

      // Start file watcher and wait for shutdown
      await runtime.startWatcher();
      await runtime.waitForShutdown();
    } catch (err) {
      p.log.error(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  },
});
