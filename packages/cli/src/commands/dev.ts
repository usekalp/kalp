import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
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
      const bootSpinner = p.spinner();
      bootSpinner.start("Starting development server...");
      await runtime.start();
      bootSpinner.stop("Development server is running at http://localhost:8787");

      const studioUrl = `${STUDIO_ORIGIN}/studio/login`;
      await open(studioUrl);
      p.log.success(`Studio available at ${pc.cyan(studioUrl)}`);

      // Start file watcher and wait for shutdown
      await runtime.startWatcher();

      // Fix: @clack/prompts doesn't restore raw mode on Windows after spinners/log calls.
      // When stdin is in raw mode, Ctrl+C sends byte 0x03 instead of generating SIGINT.
      // This must be done AFTER all clack UI calls, since p.log can also set raw mode.
      if (process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(false);
        } catch {
          /* ignore */
        }
      }

      await runtime.waitForShutdown();
    } catch (err) {
      p.log.error(
        `Failed to start: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  },
});
