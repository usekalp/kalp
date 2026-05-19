import { describe, it, expect } from "vitest";
import { loadHandlerModule } from "../../src/engine/module-loader";

describe("loadHandlerModule", () => {
  it("should load module from bundle", async () => {
    const fn = await loadHandlerModule(
      {
        bundle: "b1",
        file: "f.js",
        size: 0,
        format: "esm",
        entry: "default",
        sha256: "s1",
      } as const,
      "node-1",
      async () => "export default async () => 42",
    );
    const result = await fn(undefined, {} as never);
    expect(result).toBe(42);
  });

  it("should cache loaded modules", async () => {
    let callCount = 0;
    const loader = async () => {
      callCount++;
      return "export default async () => 42";
    };

    const binding = {
      bundle: "b1",
      file: "f.js",
      size: 0,
      format: "esm",
      entry: "default",
      sha256: "s-cache",
    } as const;
    await loadHandlerModule(binding, "node-1", loader);
    await loadHandlerModule(binding, "node-1", loader);
    expect(callCount).toBe(1);
  });

  it("should throw when default export is missing", async () => {
    await expect(
      loadHandlerModule(
        {
          bundle: "b2",
          file: "f.js",
          size: 0,
          format: "esm" as const,
          entry: "default",
          sha256: "s-nodft",
        },
        "node-1",
        async () => "export const foo = 1",
      ),
    ).rejects.toThrow("does not export a default handler");
  });
});
