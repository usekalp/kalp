import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { execa } from "execa";
import {
  findWorkerUrl,
  resolveCustomDomains,
} from "@/utils/providers/cloudflare-domains";

vi.mock("node:fs/promises");
vi.mock("execa");

const mockedReadFile = vi.mocked(readFile);
const mockedExeca = vi.mocked(execa) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeExecaResult(stdout: string) {
  return { stdout, stderr: "", exitCode: 0, failed: false, isCanceled: false, killed: false };
}

// -------------------------------------------------
// findWorkerUrl
// -------------------------------------------------
describe("findWorkerUrl", () => {
  it("extracts workers.dev URL from output", () => {
    const output = "Published\nhttps://my-project.example.workers.dev\nDone";
    expect(findWorkerUrl(output)).toBe(
      "https://my-project.example.workers.dev"
    );
  });

  it("returns null when no workers.dev URL is present", () => {
    const output = "Published\nhttps://example.com\nDone";
    expect(findWorkerUrl(output)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(findWorkerUrl("")).toBeNull();
  });

  it("extracts URL with custom subdomain", () => {
    const output = "Something https://custom-sub.workers.dev trailing text";
    expect(findWorkerUrl(output)).toBe("https://custom-sub.workers.dev");
  });

  it("handles output with multiple URLs (returns first match)", () => {
    const output =
      "Deployed https://first.workers.dev and also https://second.workers.dev";
    expect(findWorkerUrl(output)).toBe("https://first.workers.dev");
  });
});

// -------------------------------------------------
// resolveCustomDomains
// -------------------------------------------------
describe("resolveCustomDomains", () => {
  it("returns custom domains from wrangler status JSON", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "example.com", custom_domain: true },
          ],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "my-worker",
    });

    expect(domains).toContain("example.com");
  });

  it("returns sorted domains from status output", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "zulu.com", custom_domain: true },
            { pattern: "alpha.com", custom_domain: true },
          ],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual(["alpha.com", "zulu.com"]);
  });

  it("deduplicates domains", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "dup.com", custom_domain: true },
          ],
          deployments: [
            { pattern: "dup.com", custom_domain: true },
          ],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual(["dup.com"]);
  });

  it("filters out workers.dev domains from results", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "myapp.workers.dev", custom_domain: true },
            { pattern: "real-domain.com", custom_domain: true },
          ],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual(["real-domain.com"]);
  });

  it("filters out pages.dev domains", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "myapp.pages.dev", custom_domain: true },
            { pattern: "custom.app", custom_domain: true },
          ],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual(["custom.app"]);
  });

  it("normalizes domains from URL format", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "https://my-custom-domain.com/path", custom_domain: true },
          ],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toContain("my-custom-domain.com");
  });

  it("filters out entries with @ sign", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "email@domain.com", custom_domain: true },
          ],
        })
      )
    );
    // Falls through to readFile since fromStatus is empty
    mockedReadFile.mockResolvedValueOnce("{}");

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual([]);
  });

  it("filters out domains without valid TLD", async () => {
    mockedReadFile.mockResolvedValueOnce("not json");
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual([]);
  });

  it("strips wildcard prefix from domains", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(
        JSON.stringify({
          routes: [
            { pattern: "*.example.com", custom_domain: true },
          ],
        })
      )
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toContain("example.com");
  });

  it("falls back to routes config when status has no domains", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify({ routes: [] }))
    );
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        routes: [
          { pattern: "from-config.com", custom_domain: true },
        ],
      })
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "my-worker",
    });

    expect(domains).toContain("from-config.com");
  });

  it("falls back to routes config when wrangler status fails", async () => {
    mockedExeca.mockRejectedValueOnce(new Error("status failed"));
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        routes: [
          { pattern: "mysite.dev", custom_domain: true },
        ],
      })
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "my-worker",
    });

    expect(domains).toContain("mysite.dev");
  });

  it("returns empty array when both sources fail", async () => {
    mockedExeca.mockRejectedValueOnce(new Error("status failed"));
    mockedReadFile.mockRejectedValueOnce(new Error("config read failed"));

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual([]);
  });

  it("parses routes with custom_domain flag only", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify({ routes: [] }))
    );
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({
        routes: [
          { pattern: "included.com", custom_domain: true },
          { pattern: "excluded.com", custom_domain: false },
          { pattern: "also-excluded.com" },
        ],
      })
    );

    const domains = await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "worker",
    });

    expect(domains).toEqual(["included.com"]);
  });

  it("calls wrangler deployments status with correct args", async () => {
    mockedExeca.mockResolvedValueOnce(
      makeExecaResult(JSON.stringify({ routes: [] }))
    );
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({}));

    await resolveCustomDomains({
      cwd: "/cwd",
      configPath: "/cwd/wrangler.jsonc",
      workerName: "my-worker-name",
    });

    const call = mockedExeca.mock.calls[0]!;
    expect(call[0]).toBe("npx");
    const args = call[1] as string[];
    expect(args).toContain("deployments");
    expect(args).toContain("status");
    expect(args).toContain("--name");
    expect(args).toContain("my-worker-name");
    expect(args).toContain("--json");
    expect(args).toContain("--config");
    expect(args).toContain("/cwd/wrangler.jsonc");
  });
});
