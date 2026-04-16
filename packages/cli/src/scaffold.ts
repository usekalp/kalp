import { writeFile, readFile, readdir, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { getTemplateMeta, type TemplateId } from "./templates/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const TEMPLATES_DIR = join(__dirname, "..", "templates");

async function replacePlaceholders(
  dir: string,
  map: Record<string, string>,
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      await replacePlaceholders(fp, map);
    } else if (entry.isFile() && entry.name !== ".gitkeep") {
      try {
        let src = await readFile(fp, "utf-8");
        let changed = false;
        for (const [from, to] of Object.entries(map)) {
          if (src.includes(from)) {
            src = src.replaceAll(from, to);
            changed = true;
          }
        }
        if (changed) await writeFile(fp, src, "utf-8");
      } catch {
        // binary file — skip
      }
    }
  }
}

export async function scaffoldProject(opts: {
  projectName: string;
  cwd: string;
}): Promise<void> {
  const { projectName, cwd } = opts;

  // ── kalp.config.ts at root ─────────────────────────────────────────────
  const kalpConfig = `import { defineConfig } from "@kalphq/sdk";

export default defineConfig({
  projectId: "${projectName}",
  secrets: [],
});
`;
  await writeFile(join(cwd, "kalp.config.ts"), kalpConfig, "utf-8");

  // ── Root package.json (resolves @kalphq/sdk for kalp.config.ts) ──────
  await cp(join(TEMPLATES_DIR, "project-root"), cwd, {
    recursive: true,
    force: true,
  });
  await replacePlaceholders(cwd, { __PROJECT_NAME__: projectName });

  // ── kalp/ sub-package via fs.cp ───────────────────────────────────────
  const kalpDir = join(cwd, "kalp");
  await cp(join(TEMPLATES_DIR, "project"), kalpDir, {
    recursive: true,
    force: true,
  });
  await replacePlaceholders(kalpDir, { __PROJECT_NAME__: projectName });
}

export async function scaffoldAgent(opts: {
  agentName: string;
  templateId: TemplateId;
  cwd: string;
}): Promise<void> {
  const { agentName, templateId, cwd } = opts;
  const meta = getTemplateMeta(templateId);
  const agentDir = join(cwd, "kalp", "agents", agentName);

  // ── Agent files via fs.cp ─────────────────────────────────────────────
  await cp(join(TEMPLATES_DIR, "agents", templateId), agentDir, {
    recursive: true,
    force: true,
  });
  await replacePlaceholders(agentDir, { __AGENT_NAME__: agentName });

  // ── .env at root (append missing secrets) ─────────────────────────────
  if (meta.secrets.length > 0) {
    const envPath = join(cwd, ".env");
    let envExisting = "";
    try {
      envExisting = await readFile(envPath, "utf-8");
    } catch {
      // doesn't exist yet
    }
    const toAdd = meta.secrets
      .filter((s) => !envExisting.includes(s))
      .map((s) => `${s}=`)
      .join("\n");
    if (toAdd) {
      const content = envExisting
        ? envExisting.trimEnd() + "\n" + toAdd + "\n"
        : toAdd + "\n";
      await writeFile(envPath, content, "utf-8");
    }
  }
}
