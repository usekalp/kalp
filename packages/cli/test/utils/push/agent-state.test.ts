import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialState,
  ensureAgentState,
  hydrateLocalAgentVersionsFromRemoteIndex,
} from "@/utils/push/agent-state";

beforeEach(() => {});

describe("createInitialState", () => {
  it("returns a ProjectState with all fields null/empty", () => {
    const state = createInitialState();

    expect(state.workerUrl).toBeNull();
    expect(state.deployedAt).toBeNull();
    expect(state.accountId).toBeNull();
    expect(state.studioCredentialsFingerprint).toBeNull();
    expect(state.serviceKeyFingerprint).toBeNull();
    expect(state.agents).toEqual({});
  });

  it("returns a new object each call", () => {
    const state1 = createInitialState();
    const state2 = createInitialState();

    expect(state1).not.toBe(state2);
    expect(state1.agents).not.toBe(state2.agents);
  });

  it("has mutable agents map", () => {
    const state = createInitialState();

    state.agents["test"] = {
      currentHash: "abc",
      currentVersion: 1,
      lastLocalHash: null,
      lastRemoteHash: null,
      lastPushedAt: null,
      localPath: "/path",
      workerUrl: null,
    };

    expect(Object.keys(state.agents)).toHaveLength(1);
  });
});

describe("ensureAgentState", () => {
  it("creates a new agent state when agent does not exist", () => {
    const state = createInitialState();
    const agentState = ensureAgentState(state, "my-agent", "/agents/my-agent/index.ts");

    expect(agentState.currentHash).toBeNull();
    expect(agentState.currentVersion).toBe(0);
    expect(agentState.lastLocalHash).toBeNull();
    expect(agentState.lastRemoteHash).toBeNull();
    expect(agentState.lastPushedAt).toBeNull();
    expect(agentState.localPath).toBe("/agents/my-agent/index.ts");
    expect(agentState.workerUrl).toBeNull();
  });

  it("adds agent to state.agents", () => {
    const state = createInitialState();
    ensureAgentState(state, "my-agent", "/path/to/agent/index.ts");

    expect(Object.keys(state.agents)).toContain("my-agent");
  });

  it("returns the same object for subsequent calls with same name", () => {
    const state = createInitialState();
    const first = ensureAgentState(state, "same-agent", "/path/index.ts");
    const second = ensureAgentState(state, "same-agent", "/path/index.ts");

    expect(first).toBe(second);
  });

  it("updates localPath on existing agent state", () => {
    const state = createInitialState();
    const initial = ensureAgentState(state, "update-me", "/old/path.ts");
    initial.currentHash = "abc123";
    initial.currentVersion = 5;

    const updated = ensureAgentState(state, "update-me", "/new/path.ts");

    expect(updated).toBe(initial);
    expect(updated.localPath).toBe("/new/path.ts");
    expect(updated.currentHash).toBe("abc123");
    expect(updated.currentVersion).toBe(5);
  });

  it("sets workerUrl from state.workerUrl when present", () => {
    const state = createInitialState();
    state.workerUrl = "https://my-worker.dev";

    const agentState = ensureAgentState(state, "agent", "/path/index.ts");

    expect(agentState.workerUrl).toBe("https://my-worker.dev/a/agent");
  });

  it("sets workerUrl from state.workerUrl stripping trailing slash", () => {
    const state = createInitialState();
    state.workerUrl = "https://my-worker.dev/";

    const agentState = ensureAgentState(state, "agent", "/path/index.ts");

    expect(agentState.workerUrl).toBe("https://my-worker.dev/a/agent");
  });

  it("keeps workerUrl null when state.workerUrl is null", () => {
    const state = createInitialState();

    const agentState = ensureAgentState(state, "agent", "/path/index.ts");

    expect(agentState.workerUrl).toBeNull();
  });

  it("does not overwrite existing agent's workerUrl", () => {
    const state = createInitialState();
    const first = ensureAgentState(state, "agent", "/path/index.ts");
    first.workerUrl = "https://custom.url/a/agent";

    state.workerUrl = "https://new-worker.dev";
    const second = ensureAgentState(state, "agent", "/new/path/index.ts");

    expect(second.workerUrl).toBe("https://custom.url/a/agent");
  });
});

describe("hydrateLocalAgentVersionsFromRemoteIndex", () => {
  it("hydrates currentVersion from remote when local is 0", () => {
    const state = createInitialState();
    ensureAgentState(state, "agent-a", "/agents/agent-a/index.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "hash-a", versionNumber: 3, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.currentVersion).toBe(3);
  });

  it("does not overwrite currentVersion when it is already positive", () => {
    const state = createInitialState();
    const agentState = ensureAgentState(state, "agent-a", "/path/index.ts");
    agentState.currentVersion = 5;

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "hash-a", versionNumber: 3, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.currentVersion).toBe(5);
  });

  it("hydrates lastRemoteHash from remote", () => {
    const state = createInitialState();
    ensureAgentState(state, "agent-a", "/path/index.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "hash-a", versionNumber: 1, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.lastRemoteHash).toBe("hash-a");
  });

  it("does not overwrite existing lastRemoteHash", () => {
    const state = createInitialState();
    const agentState = ensureAgentState(state, "agent-a", "/path/index.ts");
    agentState.lastRemoteHash = "existing-hash";

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "new-hash", versionNumber: 1, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.lastRemoteHash).toBe("existing-hash");
  });

  it("hydrates currentHash from remote when local is null", () => {
    const state = createInitialState();
    ensureAgentState(state, "agent-a", "/path/index.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "hash-a", versionNumber: 1, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.currentHash).toBe("hash-a");
  });

  it("does not overwrite existing currentHash", () => {
    const state = createInitialState();
    const agentState = ensureAgentState(state, "agent-a", "/path/index.ts");
    agentState.currentHash = "existing";

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "new", versionNumber: 1, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.currentHash).toBe("existing");
  });

  it("hydrates lastPushedAt from remote", () => {
    const state = createInitialState();
    ensureAgentState(state, "agent-a", "/path/index.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "hash", versionNumber: 1, updatedAt: "2025-06-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.lastPushedAt).toBe("2025-06-01");
  });

  it("hydrates workerUrl from remote", () => {
    const state = createInitialState();
    ensureAgentState(state, "agent-a", "/path/index.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        {
          name: "agent-a",
          hash: "hash",
          versionNumber: 1,
          updatedAt: "2025-01-01",
          workerUrl: "https://worker.dev/a/agent-a",
        },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.workerUrl).toBe("https://worker.dev/a/agent-a");
  });

  it("sets localPath from cwd when agent has no localPath", () => {
    const state = createInitialState();
    const agentState = ensureAgentState(state, "agent-a", "/some/path/index.ts");
    agentState.localPath = "";

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "hash", versionNumber: 1, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.localPath).toBe(
      join("/project", "agents", "agent-a", "index.ts"),
    );
  });

  it("skips agents not in remote index", () => {
    const state = createInitialState();
    ensureAgentState(state, "missing-agent", "/path/index.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "other-agent", hash: "hash", versionNumber: 5, updatedAt: "2025-01-01", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["missing-agent"]!.currentVersion).toBe(0);
    expect(state.agents["missing-agent"]!.currentHash).toBeNull();
  });

  it("handles remote entry with null hash", () => {
    const state = createInitialState();
    ensureAgentState(state, "agent-a", "/path/index.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "", versionNumber: null, updatedAt: "", workerUrl: null },
      ],
      cwd: "/project",
    });

    // falsy hash shouldn't overwrite null currentHash
    expect(state.agents["agent-a"]!.currentHash).toBeNull();
  });

  it("handles multiple agents mixed with remote entries", () => {
    const state = createInitialState();
    ensureAgentState(state, "agent-a", "/path/a.ts");
    ensureAgentState(state, "agent-b", "/path/b.ts");
    ensureAgentState(state, "agent-c", "/path/c.ts");

    hydrateLocalAgentVersionsFromRemoteIndex({
      state,
      remoteEntries: [
        { name: "agent-a", hash: "ha", versionNumber: 1, updatedAt: "d1", workerUrl: null },
        { name: "agent-b", hash: "hb", versionNumber: 2, updatedAt: "d2", workerUrl: null },
      ],
      cwd: "/project",
    });

    expect(state.agents["agent-a"]!.currentVersion).toBe(1);
    expect(state.agents["agent-b"]!.currentVersion).toBe(2);
    expect(state.agents["agent-c"]!.currentVersion).toBe(0);
  });
});
