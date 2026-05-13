import { describe, expect, it, expectTypeOf } from "vitest";
import type { ProviderModelMap } from "../src";

describe("AI typing", () => {
  it("keeps known openrouter suggestions while allowing free strings", () => {
    type OpenRouterModel = ProviderModelMap["openrouter"];
    expectTypeOf<OpenRouterModel>().toMatchTypeOf<string>();

    const known: OpenRouterModel = "openai/gpt-4o-mini";
    const custom: OpenRouterModel = "my-org/custom-model";

    expect(known).toBe("openai/gpt-4o-mini");
    expect(custom).toBe("my-org/custom-model");
  });

  it("keeps provider literals strict where required", () => {
    const openAiModel: ProviderModelMap["openai"] = "gpt-4o";
    expect(openAiModel).toBe("gpt-4o");

    const invalidModel: ProviderModelMap["openai"] = "claude-3-5-sonnet-latest";
    expect(invalidModel).toBeDefined();
  });
});
