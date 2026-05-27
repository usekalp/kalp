import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  readLocalAgentNames,
  createAgentsSnapshot,
  writeRuntimeAgentsSnapshot,
} from "@/utils/runtime/agent-snapshot";
import type {
  RuntimeAgentRecord,
  LocalAgentMetadata,
} from "@/utils/runtime/agent-snapshot";

const { mockReaddir, mockStat, mockWriteFile, mockReadAgentManifest, mockReadProjectState } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockWriteFile: vi.fn(),
  mockReadAgentManifest: vi.fn(),
  mockReadProjectState: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readdir: mockReaddir,
    stat: mockStat,
    writeFile: mockWriteFile,
  };
});

vi.mock("@/utils/manifest", () => ({
  readAgentManifest: mockReadAgentManifest,
  computePushHash: vi.fn(),
}));

vi.mock("@/utils/project-state", () => ({
  readProjectState: mockReadProjectState,
  writeProjectState: vi.fn(),
}));

vi.mock("@kalphq/project", () => ({
  deriveLabelFromName: (name: string) =>
    name
      .split(/[_-]+/g)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(" "),
}));

const mockedReaddir = vi.mocked(mockReaddir);
const mockedStat = vi.mocked(mockStat);
const mockedWriteFile = vi.mocked(mockWriteFile);
const mockedReadAgentManifest = vi.mocked(mockReadAgentManifest);
const mockedReadProjectState = vi.mocked(mockReadProjectState);

function createMockDirents(names: string[], isDir = true) {
  return names.map((name) => ({
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isSymbolicLink: () => false,
    parentPath: "/fake/agents",
    path: `/fake/agents/${name}`,
  }));
}

function makeAgentState(overrides: Record<string, unknown> = {}) {
  return {
    currentHash: "hash-abc",
    currentVersion: 3,
    lastLocalHash: "hash-local",
    lastRemoteHash: "hash-remote",
    lastPushedAt: "2026-05-27T00:00:00.000Z",
    localPath: "/fake/agents/test-agent/index.ts",
    workerUrl: "https://my-project.example.workers.dev/a/test-agent",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("readLocalAgentNames", () => {
  it("returns sorted agent names from agents directory", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["agent-b", "agent-a", "agent-c"]) as never
    );
    mockedStat.mockResolvedValue({} as never);

    const names = await readLocalAgentNames("/fake/project");
    expect(names).toEqual(["agent-a", "agent-b", "agent-c"]);
  });

  it("filters out entries without index.ts", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["has-index", "missing-index", "also-has"]) as never
    );
    mockedStat
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockResolvedValueOnce({} as never);

    const names = await readLocalAgentNames("/fake/project");
    expect(names).toEqual(["also-has", "has-index"]);
  });

  it("skips non-directory entries", async () => {
    const mixed = [
      ...createMockDirents(["real-dir"]),
      ...createMockDirents(["a-file.ts"], false),
    ];
    mockedReaddir.mockResolvedValueOnce(mixed as never);
    mockedStat.mockResolvedValueOnce({} as never);

    const names = await readLocalAgentNames("/fake/project");
    expect(names).toEqual(["real-dir"]);
  });

  it("returns empty array when agents dir does not exist", async () => {
    mockedReaddir.mockRejectedValueOnce(new Error("ENOENT"));
    const names = await readLocalAgentNames("/fake/project");
    expect(names).toEqual([]);
  });

  it("returns empty array when agents dir is empty", async () => {
    mockedReaddir.mockResolvedValueOnce([] as never);
    const names = await readLocalAgentNames("/fake/project");
    expect(names).toEqual([]);
  });
});

describe("createAgentsSnapshot", () => {
  it("builds snapshot with local agents in local mode", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["greeter", "helper"]) as never
    );
    mockedStat
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);

    mockedReadAgentManifest
      .mockResolvedValueOnce({
        semanticIr: {
          agent: { label: "Greeter Agent", description: "Says hello", tags: ["greeting"] },
        },
      } as never)
      .mockResolvedValueOnce({
        semanticIr: {
          agent: { label: "Helper Agent", description: "Assists", tags: ["utility"] },
        },
      } as never);

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: "https://project.workers.dev",
      deployedAt: "2026-05-26T00:00:00.000Z",
      accountId: "acc-123",
      agents: {
        greeter: makeAgentState({
          localPath: "/fake/agents/greeter/index.ts",
          workerUrl: "https://project.workers.dev/a/greeter",
          currentVersion: 2,
          lastRemoteHash: "remote-hash-g",
        }),
        helper: makeAgentState({
          localPath: "/fake/agents/helper/index.ts",
          workerUrl: null,
          currentVersion: 0,
          lastRemoteHash: null,
        }),
      },
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "local");

    expect(snapshot.projectPath).toBe("/fake/project");
    expect(snapshot.mode).toBe("local");
    expect(snapshot.workerUrl).toBe("https://project.workers.dev");
    expect(snapshot.agents).toHaveLength(2);

    const greeter = snapshot.agents.find((a) => a.name === "greeter")!;
    expect(greeter).toBeDefined();
    expect(greeter.label).toBe("Greeter Agent");
    expect(greeter.description).toBe("Says hello");
    expect(greeter.tags).toEqual(["greeting"]);
    expect(greeter.environment).toBe("both");
    expect(greeter.status).toBe("online");
    expect(greeter.version).toBe("v2");
    expect(greeter.versionNumber).toBe(2);

    const helper = snapshot.agents.find((a) => a.name === "helper")!;
    expect(helper).toBeDefined();
    expect(helper.label).toBe("Helper Agent");
    expect(helper.environment).toBe("local");
    expect(helper.status).toBe("online");
    expect(helper.version).toBeNull();
  });

  it("excludes local-only agents in remote mode when no remote version", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["local-only", "deployed"]) as never
    );
    mockedStat
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);

    mockedReadAgentManifest
      .mockResolvedValueOnce({
        semanticIr: { agent: { label: "Local", tags: [] } },
      } as never)
      .mockResolvedValueOnce({
        semanticIr: { agent: { label: "Deployed", tags: [] } },
      } as never);

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: null,
      deployedAt: null,
      accountId: null,
      agents: {
        "local-only": makeAgentState({
          localPath: "/fake/agents/local-only/index.ts",
          lastRemoteHash: null,
          currentVersion: 0,
          workerUrl: null,
        }),
        deployed: makeAgentState({
          localPath: "/fake/agents/deployed/index.ts",
          lastRemoteHash: "hash-remote",
          currentVersion: 1,
          workerUrl: "https://proj.workers.dev/a/deployed",
        }),
      },
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "remote");
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0]!.name).toBe("deployed");
    expect(snapshot.agents[0]!.environment).toBe("remote");
  });

  it("includes remote-only agents from state in remote mode", async () => {
    mockedReaddir.mockResolvedValueOnce([] as never);

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: "https://proj.workers.dev",
      deployedAt: "2026-05-26T00:00:00.000Z",
      accountId: "acc-1",
      agents: {
        "remote-agent": {
          currentHash: "hash-1",
          currentVersion: 5,
          lastLocalHash: "llh",
          lastRemoteHash: "lrh",
          lastPushedAt: "2026-05-25T00:00:00.000Z",
          localPath: null,
          workerUrl: "https://proj.workers.dev/a/remote-agent",
        },
      },
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "remote");
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0]!.name).toBe("remote-agent");
    expect(snapshot.agents[0]!.environment).toBe("remote");
    expect(snapshot.agents[0]!.status).toBe("online");
    expect(snapshot.agents[0]!.version).toBe("v5");
  });

  it("handles null project state", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["agent-a"]) as never
    );
    mockedStat.mockResolvedValueOnce({} as never);

    mockedReadAgentManifest.mockResolvedValueOnce({
      semanticIr: { agent: { label: "Agent A", tags: [] } },
    } as never);

    mockedReadProjectState.mockResolvedValueOnce(null);

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0]!.name).toBe("agent-a");
    expect(snapshot.agents[0]!.hash).toBeNull();
    expect(snapshot.workerUrl).toBeNull();
  });

  it("derives workerUrl from project state when agent has no URL", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["no-url"]) as never
    );
    mockedStat.mockResolvedValueOnce({} as never);

    mockedReadAgentManifest.mockResolvedValueOnce({
      semanticIr: { agent: { label: "No Url", tags: [] } },
    } as never);

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: "https://project.workers.dev",
      deployedAt: null,
      accountId: null,
      agents: {
        "no-url": makeAgentState({
          localPath: "/fake/agents/no-url/index.ts",
          workerUrl: null,
          currentVersion: 0,
          lastRemoteHash: null,
        }),
      },
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    expect(snapshot.agents[0]!.workerUrl).toBe(
      "https://project.workers.dev/a/no-url"
    );
  });

  it("uses deriveLabelFromName when manifest has no label", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["my_cool_agent"]) as never
    );
    mockedStat.mockResolvedValueOnce({} as never);

    mockedReadAgentManifest.mockResolvedValueOnce({
      semanticIr: { agent: { label: undefined, tags: [] } },
    } as never);

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: null,
      deployedAt: null,
      accountId: null,
      agents: {},
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    expect(snapshot.agents[0]!.label).toBe("My Cool Agent");
  });

  it("handles agent with no manifest (readAgentManifest throws)", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["bad-agent"]) as never
    );
    mockedStat.mockResolvedValueOnce({} as never);

    mockedReadAgentManifest.mockRejectedValueOnce(new Error("No manifest"));

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: null,
      deployedAt: null,
      accountId: null,
      agents: {},
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0]!.label).toBe("Bad Agent");
  });

  it("sorts agents alphabetically by name", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["z-agent", "a-agent", "m-agent"]) as never
    );
    mockedStat
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);

    mockedReadAgentManifest
      .mockResolvedValueOnce({
        semanticIr: { agent: { label: "Z", tags: [] } },
      } as never)
      .mockResolvedValueOnce({
        semanticIr: { agent: { label: "A", tags: [] } },
      } as never)
      .mockResolvedValueOnce({
        semanticIr: { agent: { label: "M", tags: [] } },
      } as never);

    mockedReadProjectState.mockResolvedValueOnce(null);

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    const names = snapshot.agents.map((a) => a.name);
    expect(names).toEqual(["a-agent", "m-agent", "z-agent"]);
  });

  it("populates updatedAt from lastPushedAt", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["agent"]) as never
    );
    mockedStat.mockResolvedValueOnce({} as never);

    mockedReadAgentManifest.mockResolvedValueOnce({
      semanticIr: { agent: { label: "A", tags: [] } },
    } as never);

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: null,
      deployedAt: null,
      accountId: null,
      agents: {
        agent: makeAgentState({
          localPath: "/fake/agents/agent/index.ts",
          lastPushedAt: "2026-01-15T10:30:00.000Z",
        }),
      },
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    expect(snapshot.agents[0]!.updatedAt).toBe("2026-01-15T10:30:00.000Z");
  });

  it("falls back to deployedAt when lastPushedAt is null", async () => {
    mockedReaddir.mockResolvedValueOnce(
      createMockDirents(["agent"]) as never
    );
    mockedStat.mockResolvedValueOnce({} as never);

    mockedReadAgentManifest.mockResolvedValueOnce({
      semanticIr: { agent: { label: "A", tags: [] } },
    } as never);

    mockedReadProjectState.mockResolvedValueOnce({
      workerUrl: null,
      deployedAt: "2026-05-01T00:00:00.000Z",
      accountId: null,
      agents: {
        agent: makeAgentState({
          localPath: "/fake/agents/agent/index.ts",
          lastPushedAt: null,
        }),
      },
    });

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    expect(snapshot.agents[0]!.updatedAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("includes generatedAt timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));

    mockedReaddir.mockResolvedValueOnce([] as never);
    mockedReadProjectState.mockResolvedValueOnce(null);

    const snapshot = await createAgentsSnapshot("/fake/project", "local");
    expect(snapshot.generatedAt).toBe("2026-05-27T12:00:00.000Z");
  });
});

describe("writeRuntimeAgentsSnapshot", () => {
  it("writes snapshot JSON to agents.snapshot.json", async () => {
    mockedReaddir.mockResolvedValueOnce([] as never);
    mockedReadProjectState.mockResolvedValueOnce(null);

    await writeRuntimeAgentsSnapshot({
      cwd: "/fake/project",
      runtimeDir: "/fake/runtime",
      mode: "local",
    });

    expect(mockedWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, content] = mockedWriteFile.mock.calls[0];
    expect(filePath).toMatch(/agents\.snapshot\.json$/);

    const parsed = JSON.parse(content as string);
    expect(parsed.projectPath).toBe("/fake/project");
    expect(parsed.mode).toBe("local");
  });
});

describe("RuntimeAgentRecord type", () => {
  it("has all required fields with correct types", () => {
    const record: RuntimeAgentRecord = {
      name: "test-agent",
      label: "Test Agent",
      tags: ["test"],
      description: "A test agent",
      environment: "local",
      status: "offline",
      hash: null,
      version: null,
      versionNumber: null,
      lastRemoteHash: null,
      lastLocalHash: null,
      workerUrl: null,
      localPath: "/fake/path",
      updatedAt: null,
    };
    expect(record.name).toBe("test-agent");
  });
});

describe("LocalAgentMetadata type", () => {
  it("supports optional fields", () => {
    const meta: LocalAgentMetadata = {
      label: "My Agent",
      description: "Does things",
      tags: ["a", "b"],
    };
    expect(meta.label).toBe("My Agent");
    expect(meta.tags).toHaveLength(2);

    const empty: LocalAgentMetadata = {};
    expect(empty.label).toBeUndefined();
  });
});
