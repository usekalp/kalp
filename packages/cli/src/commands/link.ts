import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "link", description: "Link project to Kalp cloud" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp link")}`);

    const s = p.spinner();
    s.start("Linking to workspace");

    // Create .temp directory and workspace config (project local)
    const tempDir = join(cwd, ".temp");
    await mkdir(tempDir, { recursive: true });

    // TODO: Get actual workspace ID from API after login
    const workspaceConfig = {
      workspaceId: "mock-workspace-id",
      linkedAt: new Date().toISOString(),
      projectPath: cwd,
    };

    await writeFile(
      join(tempDir, "workspace.json"),
      JSON.stringify(workspaceConfig, null, 2),
      "utf-8",
    );

    s.stop("Workspace linked");
    p.outro(pc.green("Project linked to Kalp Cloud"));
  },
});
