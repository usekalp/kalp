import { describe, expect, it, expectTypeOf } from "vitest";
import type { AIParams, ProviderModelMap } from "../src";

declare global {
  interface KalpAIEnvironment {
    provider: "openrouter";
  }
}

describe("AI typing", () => {
  it("keeps known openrouter suggestions while allowing free strings", () => {
    type OpenRouterModel = ProviderModelMap["openrouter"];
    expectTypeOf<OpenRouterModel>().toMatchTypeOf<string>();

    const params: AIParams = {
      prompt: "hello",
      model: "openai/gpt-4o-mini",
    };

    const customParams: AIParams = {
      prompt: "hello",
      model: "my-org/custom-model",
    };

    expect(params.model).toBe("openai/gpt-4o-mini");
    expect(customParams.model).toBe("my-org/custom-model");
  });

  it("keeps provider literals strict where required", () => {
    const openAiModel: ProviderModelMap["openai"] = "gpt-4o";
    expect(openAiModel).toBe("gpt-4o");

    // @ts-expect-error anthropic model is not valid for openai provider union
    const invalidModel: ProviderModelMap["openai"] = "claude-3-5-sonnet-latest";
    expect(invalidModel).toBeDefined();
  });
});
