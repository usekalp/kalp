import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import {
  buildWorkerName,
  resolveProjectSlug,
  createRuntimeConfig,
  readExistingKvNamespaceIds,
  WORKER_ENTRY_FILE,
  COMPATIBILITY_DATE,
} from "@/utils/runtime/wrangler-config";

vi.mock("node:fs/promises");

const mockedReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildWorkerName", () => {
  it("prefixes name with kalp- and appends cwd hash", () => {
    const name = buildWorkerName("my-agent", "/home/user/projects/agent");
    expect(name).toMatch(/^kalp-my-agent-[a-f0-9]{8}$/);
  });

  it("produces deterministic hash for same cwd", () => {
    const a = buildWorkerName("test", "/projects/foo");
    const b = buildWorkerName("test", "/projects/foo");
    expect(a).toBe(b);
  });

  it("produces different hashes for different cwds", () => {
    const a = buildWorkerName("test", "/projects/foo");
    const b = buildWorkerName("test", "/projects/bar");
    expect(a).not.toBe(b);
  });

  it("truncates to 63 characters when too long", () => {
    const longSlug = "a".repeat(60);
    const name = buildWorkerName(longSlug, "/some/cwd");
    expect(name.length).toBeLessThanOrEqual(63);
  });

  it("strips trailing dashes after truncation", () => {
    const slug = "a".repeat(54);
    const name = buildWorkerName(slug, "/some/cwd");
    expect(name.endsWith("-")).toBe(false);
  });

  it("falls back to kalp-hash if slug is clipped entirely", () => {
    const slug = "a".repeat(70);
    const name = buildWorkerName(slug, "/x");
    expect(name).toMatch(/^kalp-/);
    expect(name.length).toBeLessThanOrEqual(63);
  });
});

describe("resolveProjectSlug", () => {
  it("reads name from package.json", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "my-cool-project" }));
    const slug = await resolveProjectSlug("/home/user/project");
    expect(slug).toBe("my-cool-project");
  });

  it("sanitizes scoped package names", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "@scope/my-package" }));
    const slug = await resolveProjectSlug("/home/user/project");
    expect(slug).toBe("scope-my-package");
  });

  it("replaces special chars with dashes", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "My_Project@v1" }));
    const slug = await resolveProjectSlug("/home/user/project");
    expect(slug).toBe("my-project-v1");
  });

  it("collapses multiple dashes", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "hello---world" }));
    const slug = await resolveProjectSlug("/home/user/project");
    expect(slug).toBe("hello-world");
  });

  it("strips leading and trailing dashes", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "---hello---" }));
    const slug = await resolveProjectSlug("/home/user/project");
    expect(slug).toBe("hello");
  });

  it("falls back to directory name when package.json is missing", async () => {
    mockedReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    const slug = await resolveProjectSlug("/home/user/my-agent-dir");
    expect(slug).toBe("my-agent-dir");
  });

  it("falls back to 'agent' when directory name sanitizes to empty", async () => {
    mockedReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    const slug = await resolveProjectSlug("/home/user/---");
    expect(slug).toBe("agent");
  });

  it("sanitizes directory name fallback", async () => {
    mockedReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    const slug = await resolveProjectSlug("/home/user/My_Dir");
    expect(slug).toBe("my-dir");
  });

  it("falls back to dir name when package name is empty string", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "" }));
    const slug = await resolveProjectSlug("/home/user/my-dir");
    expect(slug).toBe("my-dir");
  });

  it("falls back to dir name when name is not a string", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: 123 }));
    const slug = await resolveProjectSlug("/home/user/my-dir");
    expect(slug).toBe("my-dir");
  });
});

describe("createRuntimeConfig", () => {
  it("generates config with correct name", () => {
    const config = createRuntimeConfig("kalp-test-abcdef12", "local", []);
    expect(config.name).toBe("kalp-test-abcdef12");
  });

  it("sets main to worker entry file", () => {
    const config = createRuntimeConfig("test", "local", []);
    expect(config.main).toBe(`./${WORKER_ENTRY_FILE}`);
  });

  it("includes correct compatibility_date", () => {
    const config = createRuntimeConfig("test", "local", []);
    expect(config.compatibility_date).toBe(COMPATIBILITY_DATE);
  });

  it("includes nodejs_compat flag", () => {
    const config = createRuntimeConfig("test", "local", []);
    expect(config.compatibility_flags).toContain("nodejs_compat");
  });

  it("includes durable object binding for KalpAgent", () => {
    const config = createRuntimeConfig("test", "local", []);
    const doBinding = config.durable_objects.bindings.find(
      (b) => b.name === "KALP_RUNTIME_CLOUDFLARE"
    );
    expect(doBinding).toBeDefined();
    expect(doBinding!.class_name).toBe("KalpAgent");
  });

  it("includes KV namespace binding for manifests", () => {
    const config = createRuntimeConfig("test", "local", []);
    const kv = config.kv_namespaces.find((k) => k.binding === "KALP_MANIFESTS");
    expect(kv).toBeDefined();
  });

  it("includes migrations with v1 and v2 tags", () => {
    const config = createRuntimeConfig("test", "local", []);
    expect(config.migrations).toHaveLength(2);
    expect(config.migrations[0]!.tag).toBe("v1");
    expect(config.migrations[1]!.tag).toBe("v2");
  });

  it("sets KALP_ENV based on mode", () => {
    const local = createRuntimeConfig("test", "local", []);
    expect(local.vars.KALP_ENV).toBe("local");

    const remote = createRuntimeConfig("test", "remote", []);
    expect(remote.vars.KALP_ENV).toBe("remote");
  });

  it("includes required secrets", () => {
    const config = createRuntimeConfig("test", "remote", ["SECRET_A", "SECRET_B"]);
    expect(config.secrets.required).toEqual(["SECRET_A", "SECRET_B"]);
  });

  it("has empty secrets array when no secrets required", () => {
    const config = createRuntimeConfig("test", "local", []);
    expect(config.secrets.required).toEqual([]);
  });

  it("includes assets configuration", () => {
    const config = createRuntimeConfig("test", "local", []);
    expect(config.assets).toBeDefined();
    expect(config.assets!.directory).toBe("./studio");
    expect(config.assets!.binding).toBe("ASSETS");
    expect(config.assets!.run_worker_first).toBe(true);
  });

  it("enables observability and source maps", () => {
    const config = createRuntimeConfig("test", "local", []);
    expect(config.observability.enabled).toBe(true);
    expect(config.upload_source_maps).toBe(true);
  });
});

describe("readExistingKvNamespaceIds", () => {
  it("parses KV namespace bindings from wrangler config", async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        kv_namespaces: [
          { binding: "KALP_MANIFESTS", id: "abc123" },
          { binding: "MY_KV", id: "def456" },
        ],
      })
    );
    const ids = await readExistingKvNamespaceIds("/path/to/wrangler.jsonc");
    expect(ids).toEqual({ KALP_MANIFESTS: "abc123", MY_KV: "def456" });
  });

  it("skips entries without id", async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        kv_namespaces: [
          { binding: "NO_ID_BINDING" },
          { binding: "HAS_ID", id: "xyz789" },
        ],
      })
    );
    const ids = await readExistingKvNamespaceIds("/path/to/wrangler.jsonc");
    expect(ids).toEqual({ HAS_ID: "xyz789" });
  });

  it("skips entries without binding", async () => {
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        kv_namespaces: [{ id: "no-binding-id" }],
      })
    );
    const ids = await readExistingKvNamespaceIds("/path/to/wrangler.jsonc");
    expect(ids).toEqual({});
  });

  it("returns empty object when file is missing", async () => {
    mockedReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    const ids = await readExistingKvNamespaceIds("/missing/config.jsonc");
    expect(ids).toEqual({});
  });

  it("returns empty object for invalid JSON", async () => {
    mockedReadFile.mockResolvedValueOnce("not valid json");
    const ids = await readExistingKvNamespaceIds("/bad/config.jsonc");
    expect(ids).toEqual({});
  });

  it("returns empty object when kv_namespaces is missing", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "test-worker" }));
    const ids = await readExistingKvNamespaceIds("/path/to/wrangler.jsonc");
    expect(ids).toEqual({});
  });
});
