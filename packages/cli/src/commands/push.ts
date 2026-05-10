import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";
import { ensureConfig } from "@/utils/fs";
import { readAgentManifest, computePushHash } from "@/utils/manifest";
import { requireAuth } from "@/utils/auth";
import { runInitialDeploy } from "@/utils/deploy";
import { readProjectState } from "@/utils/project-state";
import { validateCompiledIR } from "@/utils/validate";
import { getAgentStoreEntry, writeAgentStoreEntry } from "@/utils/agent-store";

const LOGO = "🦋";
const WRANGLER_CONFIG = "packages/cloudflare/wrangler.jsonc";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default defineCommand({
  meta: { name: "push", description: "Push agent manifest to Cloudflare KV" },
  args: {
    agent: {
      type: "string",
      alias: "a",
      description: "Agent name to push",
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const agentName = args.agent;

    p.intro(`${LOGO} ${pc.bold("kalp push")}`);

    if (!agentName) {
      p.log.error(`Missing required flag ${pc.cyan("-a <agent-name>")}`);
      process.exit(1);
    }

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    await ensureConfig(cwd).catch(() => {
      p.log.error(`${pc.cyan("kalp.config.ts")} not found`);
      process.exit(1);
    });

    const agentPath = join(cwd, "agents", agentName, "index.ts");
    await access(agentPath).catch(() => {
      p.log.error(`Agent ${pc.cyan(agentName)} not found`);
      process.exit(1);
    });

    let state = await readProjectState(cwd);
    if (!state) {
      p.log.warn("No .kalp/state.json found. Running initial deploy first...");
      const deploy = await runInitialDeploy(cwd);
      state = {
        workerUrl: deploy.workerUrl,
        deployedAt: new Date().toISOString(),
        accountId: deploy.accountId,
      };
    }

    const s = p.spinner();
    s.start(`Compiling ${pc.cyan(agentName)}`);
    const manifest = await readAgentManifest({ cwd, agentName });
    const hash = computePushHash(manifest.ir);
    s.stop(`Compiled ${pc.cyan(agentName)} (${hash.slice(0, 8)})`);

    const validation = validateCompiledIR({ agentName, ir: manifest.ir, hash });
    if (!validation.ok) {
      p.log.error(`Validation failed at phase: ${validation.phase}`);
      for (const err of validation.errors ?? []) {
        p.log.error(err);
      }
      process.exit(1);
    }

    const previous = await getAgentStoreEntry(agentName);
    const agentWorkerUrl = `${state.workerUrl.replace(/\/$/, "")}/a/${agentName}`;
    if (previous?.hash === hash && previous.workerUrl === agentWorkerUrl) {
      p.note(
        `No changes detected for ${pc.cyan(agentName)} (${hash.slice(0, 8)}).`,
        "Skipped",
      );
      p.outro(`${LOGO} ${pc.green("Nothing to push")}`);
      return;
    }

    const manifestKey = `${agentName}:${hash}`;
    const latestKey = `${agentName}:latest`;
    const manifestPath = join(cwd, ".kalp", `${agentName}-${hash}.json`);

    await mkdir(join(cwd, ".kalp"), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(manifest.ir), "utf-8");

    try {
      s.start("Uploading manifest to Cloudflare KV");
      await execa(
        "npx",
        [
          "wrangler",
          "kv",
          "key",
          "put",
          "--binding",
          "KALP_MANIFESTS",
          manifestKey,
          "--path",
          manifestPath,
          "--remote",
          "--config",
          WRANGLER_CONFIG,
        ],
        { cwd },
      );

      await execa(
        "npx",
        [
          "wrangler",
          "kv",
          "key",
          "put",
          "--binding",
          "KALP_MANIFESTS",
          latestKey,
          hash,
          "--remote",
          "--config",
          WRANGLER_CONFIG,
        ],
        { cwd },
      );
      s.stop("Manifest uploaded");
    } finally {
      await rm(manifestPath, { force: true });
    }

    const bundles = manifest.ir.bundles || {};
    const totalSize = Object.values(bundles).reduce(
      (sum, bundle) => sum + Buffer.byteLength(bundle.code),
      0,
    );
    const handlerCount = Object.keys(bundles).length;

    await writeAgentStoreEntry(agentName, {
      hash,
      timestamp: new Date().toISOString(),
      workerUrl: agentWorkerUrl,
      localPath: agentPath,
    });

    p.log.success(
      `${pc.bold(agentName)} pushed · ${handlerCount} handlers · ${formatBytes(totalSize)}`,
    );
    p.note(`KV keys updated: ${manifestKey}, ${latestKey}`, "Cloudflare KV");
    p.outro(`${LOGO} ${pc.green("Live at")} ${pc.cyan(agentWorkerUrl)}`);
  },
});
