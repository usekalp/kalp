import { access } from "node:fs/promises";
import { join } from "node:path";
import { compileAgent } from "@kalphq/compiler";
import { loadAgentModule, cleanupTempDir } from "@/utils/manifest/build";
import type { AgentManifestV2 } from "@/utils/manifest/types";

export type {
  AgentManifestV2,
  LoadedAgentModule,
} from "@/utils/manifest/types";

export { asRecord, asString, asArray } from "@/utils/manifest/types";

export { loadAgentModule, cleanupTempDir } from "@/utils/manifest/build";

export { getManifestHash } from "@/utils/manifest/hash";

export { getIRHash } from "@/utils/ir/hashIR";

export async function readAgentManifest(params: {
  cwd: string;
  agentName: string;
}): Promise<AgentManifestV2> {
  const { cwd, agentName } = params;
  const agentPath = join(cwd, "agents", agentName, "index.ts");
  await access(agentPath);

  let tempDir: string | undefined;

  try {
    const loaded = await loadAgentModule(agentPath, cwd);
    tempDir = loaded.tempDir;

    const ir = await compileAgent(loaded.agent);

    return {
      format: "kalp-agent-manifest",
      schemaVersion: 2,
      codeHash: loaded.codeHash,
      ir,
      bundle: {
        entry: loaded.entry,
        hash: loaded.codeHash,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}
