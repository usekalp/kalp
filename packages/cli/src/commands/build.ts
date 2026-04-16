import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { z } from "zod";
import * as esbuild from "esbuild";
import { glob } from "./utils.js";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "build", description: "Bundle agents for deployment" },
  async run() {
    await _build();
  },
});

const KalpConfigSchema = z.object({
  projectId: z.string().min(1),
  region: z.string().optional(),
  secrets: z.array(z.string()).optional(),
});

async function _build(): Promise<void> {
  p.intro(`${LOGO} ${pc.bold("kalp build")}`);

  const cwd = process.cwd();
  const configPath = resolve(cwd, "kalp.config.ts");

  // ── Validate kalp.config.ts ────────────────────────────────────────────
  const s = p.spinner();
  s.start("Reading kalp.config.ts");

  let configRaw = "";
  try {
    configRaw = await readFile(configPath, "utf-8");
  } catch {
    s.stop(pc.red("kalp.config.ts not found"));
    p.outro(`${pc.dim("Run")} ${pc.cyan("kalp init")} ${pc.dim("first.")}`);
    process.exit(1);
  }

  // Extract the config object from defineConfig({...}) using a lightweight regex
  const match = configRaw.match(/defineConfig\(\s*(\{[\s\S]*?\})\s*\)/);
  if (!match?.[1]) {
    s.stop(pc.red("Could not parse kalp.config.ts"));
    process.exit(1);
  }

  let parsed: z.infer<typeof KalpConfigSchema>;
  try {
    // Evaluate the config object (safe: it's the user's own config file)
    const fn = new Function(`return ${match[1]}`);
    parsed = KalpConfigSchema.parse(fn());
  } catch (err) {
    s.stop(pc.red("Invalid kalp.config.ts"));
    if (err instanceof z.ZodError) {
      for (const issue of err.issues) {
        p.log.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
    }
    process.exit(1);
  }

  s.stop(`Project ${pc.cyan(parsed.projectId)} validated`);

  // ── Discover agent entry points ────────────────────────────────────────
  s.start("Discovering agents");

  const agentEntries = await glob(resolve(cwd, "kalp/agents/*/index.ts"));
  if (agentEntries.length === 0) {
    s.stop(pc.yellow("No agents found in kalp/agents/"));
    p.outro(pc.dim("Create an agent first."));
    process.exit(0);
  }

  s.stop(`Found ${pc.cyan(String(agentEntries.length))} agent(s)`);

  // ── Bundle with esbuild ────────────────────────────────────────────────
  s.start("Bundling agents");

  const outdir = resolve(cwd, "kalp/meta/dist");
  try {
    await esbuild.build({
      entryPoints: agentEntries,
      bundle: true,
      platform: "node",
      target: "es2022",
      format: "esm",
      outdir,
      minify: true,
      treeShaking: true,
      external: ["@kalphq/sdk"],
      logLevel: "silent",
    });
  } catch (err) {
    s.stop(pc.red("Build failed"));
    console.error(err);
    process.exit(1);
  }

  s.stop("Bundle ready");

  // ── Summary ────────────────────────────────────────────────────────────
  const lines = agentEntries.map(
    (e: string) => `  ${pc.dim("•")} ${pc.cyan(relative(cwd, e))}`,
  );
  p.note(lines.join("\n"), "Bundled agents");

  p.outro(
    `${LOGO} ${pc.green("Build complete.")} ${pc.dim(`Output → kalp/meta/dist/`)}`,
  );
}
