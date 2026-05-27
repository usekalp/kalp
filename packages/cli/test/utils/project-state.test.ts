import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectState, writeProjectState } from "@/utils/project-state";
import type { ProjectState } from "@/utils/project-state";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "kalp-ps-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createStateFile(dir: string, content: unknown): Promise<void> {
  const kalpDir = join(dir, ".kalp");
  await mkdir(kalpDir, { recursive: true });
  await writeFile(join(kalpDir, "state.json"), JSON.stringify(content), "utf-8");
}

function makeSampleState(): ProjectState {
  return {
    workerUrl: "https://my-worker.dev",
    deployedAt: "2025-01-01T00:00:00.000Z",
    accountId: "abc-123",
    studioCredentialsFingerprint: null,
    serviceKeyFingerprint: null,
    agents: {
      "agent-a": {
        currentHash: "hash-a",
        currentVersion: 3,
        lastLocalHash: "hash-local-a",
        lastRemoteHash: "hash-remote-a",
        lastPushedAt: "2025-01-01T01:00:00.000Z",
        localPath: "agents/agent-a",
        workerUrl: "https://agent-a.dev",
      },
    },
  };
}

describe("readProjectState", () => {
  it("reads and returns a valid project state", async () => {
    await createStateFile(tempDir, makeSampleState());

    const result = await readProjectState(tempDir);

    expect(result).not.toBeNull();
    expect(result!.workerUrl).toBe("https://my-worker.dev");
    expect(result!.deployedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(result!.accountId).toBe("abc-123");
    expect(result!.agents).toHaveProperty("agent-a");
    expect(result!.agents["agent-a"]!.currentHash).toBe("hash-a");
    expect(result!.agents["agent-a"]!.currentVersion).toBe(3);
    expect(result!.agents["agent-a"]!.lastLocalHash).toBe("hash-local-a");
    expect(result!.agents["agent-a"]!.lastRemoteHash).toBe("hash-remote-a");
    expect(result!.agents["agent-a"]!.lastPushedAt).toBe("2025-01-01T01:00:00.000Z");
    expect(result!.agents["agent-a"]!.localPath).toBe("agents/agent-a");
    expect(result!.agents["agent-a"]!.workerUrl).toBe("https://agent-a.dev");
  });

  it("returns null when state file does not exist", async () => {
    const result = await readProjectState(tempDir);

    expect(result).toBeNull();
  });

  it("returns null for corrupted JSON", async () => {
    const kalpDir = join(tempDir, ".kalp");
    await mkdir(kalpDir, { recursive: true });
    await writeFile(join(kalpDir, "state.json"), "not valid json {{{", "utf-8");

    const result = await readProjectState(tempDir);

    expect(result).toBeNull();
  });

  it("returns state with empty agents object", async () => {
    await createStateFile(tempDir, {
      workerUrl: "https://w.dev",
      deployedAt: null,
      accountId: null,
      agents: {},
    });

    const result = await readProjectState(tempDir);

    expect(result).not.toBeNull();
    expect(result!.workerUrl).toBe("https://w.dev");
    expect(result!.deployedAt).toBeNull();
    expect(result!.accountId).toBeNull();
    expect(result!.agents).toEqual({});
  });

  it("skips agent entries that are not objects", async () => {
    await createStateFile(tempDir, {
      agents: {
        valid: {
          localPath: "agents/valid",
          currentVersion: 1,
        },
        invalid: "not-an-object",
      },
    });

    const result = await readProjectState(tempDir);

    expect(result!.agents).toHaveProperty("valid");
    expect(result!.agents).not.toHaveProperty("invalid");
  });

  it("skips agent entries without localPath", async () => {
    await createStateFile(tempDir, {
      agents: {
        hasPath: {
          localPath: "agents/has",
          currentVersion: 1,
        },
        noPath: {
          currentVersion: 1,
        },
      },
    });

    const result = await readProjectState(tempDir);

    expect(result!.agents).toHaveProperty("hasPath");
    expect(result!.agents).not.toHaveProperty("noPath");
  });

  it("skips agent entries with empty localPath string", async () => {
    await createStateFile(tempDir, {
      agents: {
        empty: {
          localPath: "",
          currentVersion: 1,
        },
        valid: {
          localPath: "agents/valid",
        },
      },
    });

    const result = await readProjectState(tempDir);

    expect(result!.agents).toHaveProperty("valid");
    expect(result!.agents).not.toHaveProperty("empty");
  });

  it("clamps negative currentVersion to 0", async () => {
    await createStateFile(tempDir, {
      agents: {
        bad: {
          localPath: "agents/bad",
          currentVersion: -5,
        },
      },
    });

    const result = await readProjectState(tempDir);

    expect(result!.agents["bad"]!.currentVersion).toBe(0);
  });

  it("defaults currentVersion to 0 when non-numeric", async () => {
    await createStateFile(tempDir, {
      agents: {
        test: {
          localPath: "agents/test",
          currentVersion: "not-a-number",
        },
      },
    });

    const result = await readProjectState(tempDir);

    expect(result!.agents["test"]!.currentVersion).toBe(0);
  });

  it("returns normalized state for JSON array (arrays are typeof object)", async () => {
    await createStateFile(tempDir, [1, 2, 3]);

    const result = await readProjectState(tempDir);

    expect(result).not.toBeNull();
    expect(result!.workerUrl).toBeNull();
    expect(result!.agents).toEqual({});
  });

  it("returns null for state that is a primitive (JSON string)", async () => {
    await createStateFile(tempDir, "just a string");

    const result = await readProjectState(tempDir);

    expect(result).toBeNull();
  });

  it("returns null workerUrl when empty string in state", async () => {
    await createStateFile(tempDir, { workerUrl: "", agents: {} });

    const result = await readProjectState(tempDir);

    expect(result!.workerUrl).toBeNull();
  });

  it("returns null fields for missing optional keys", async () => {
    await createStateFile(tempDir, { agents: {} });

    const result = await readProjectState(tempDir);

    expect(result).not.toBeNull();
    expect(result!.workerUrl).toBeNull();
    expect(result!.deployedAt).toBeNull();
    expect(result!.accountId).toBeNull();
    expect(result!.studioCredentialsFingerprint).toBeNull();
    expect(result!.serviceKeyFingerprint).toBeNull();
  });
});

describe("writeProjectState", () => {
  it("writes state to .kalp/state.json", async () => {
    const state = makeSampleState();

    await writeProjectState(tempDir, state);

    const read = await readProjectState(tempDir);
    expect(read).toEqual(state);
  });

  it("creates .kalp directory if it does not exist", async () => {
    const state: ProjectState = {
      workerUrl: "https://x.dev",
      deployedAt: null,
      accountId: null,
      studioCredentialsFingerprint: null,
      serviceKeyFingerprint: null,
      agents: {},
    };

    await writeProjectState(tempDir, state);

    const result = await readProjectState(tempDir);
    expect(result).toEqual(state);
  });

  it("overwrites existing state file", async () => {
    const first: ProjectState = {
      workerUrl: "https://first.dev",
      deployedAt: null,
      accountId: null,
      studioCredentialsFingerprint: null,
      serviceKeyFingerprint: null,
      agents: {},
    };
    await writeProjectState(tempDir, first);

    const second = makeSampleState();
    await writeProjectState(tempDir, second);

    const result = await readProjectState(tempDir);
    expect(result).toEqual(second);
  });

  it("round-trip preserves all agent fields", async () => {
    const state: ProjectState = {
      workerUrl: "https://w1.dev",
      deployedAt: "2025-03-01T12:00:00.000Z",
      accountId: "acc-456",
      studioCredentialsFingerprint: "fp-studio-abc",
      serviceKeyFingerprint: "fp-service-xyz",
      agents: {
        "alpha": {
          currentHash: "h-alpha",
          currentVersion: 5,
          lastLocalHash: "lh-alpha",
          lastRemoteHash: "rh-alpha",
          lastPushedAt: "2025-03-01T13:00:00.000Z",
          localPath: "agents/alpha",
          workerUrl: "https://alpha.dev",
        },
        "beta": {
          currentHash: null,
          currentVersion: 0,
          lastLocalHash: null,
          lastRemoteHash: null,
          lastPushedAt: null,
          localPath: "agents/beta",
          workerUrl: null,
        },
      },
    };

    await writeProjectState(tempDir, state);
    const result = await readProjectState(tempDir);

    expect(result).toEqual(state);
    expect(result!.agents["alpha"]!.currentVersion).toBe(5);
    expect(result!.agents["beta"]!.currentVersion).toBe(0);
    expect(result!.studioCredentialsFingerprint).toBe("fp-studio-abc");
    expect(result!.serviceKeyFingerprint).toBe("fp-service-xyz");
  });
});
