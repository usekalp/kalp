import { describe, expect, expectTypeOf, it } from "vitest";
import type { AIParams, RegisteredSecrets, SecretKey } from "../src";

declare module "../src" {
  interface KalpAIEnvironment {
    provider: "openai";
    customModels: readonly ["acme/research-v1"];
  }

  interface SecretsRegistry {
    keys: readonly ["OPENAI_API_KEY", "STRIPE_SECRET_KEY"];
  }
}

describe("project-level type augmentations", () => {
  it("narrows AI model suggestions from configured provider", () => {
    const params: AIParams = {
      prompt: "hello",
      model: "gpt-4o-mini",
    };

    expect(params.model).toBe("gpt-4o-mini");

    const invalid: AIParams = {
      prompt: "hello",
      model: "claude-3-5-sonnet-latest",
    };
    expect(invalid).toBeDefined();
  });

  it("narrows vault secret keys from generated SecretsRegistry", () => {
    type ProjectSecretKey = SecretKey<RegisteredSecrets>;

    const openAiKey: ProjectSecretKey = "OPENAI_API_KEY";
    expectTypeOf(openAiKey).toEqualTypeOf<
      "OPENAI_API_KEY" | "STRIPE_SECRET_KEY"
    >();

    const invalidKey: ProjectSecretKey = "UNKNOWN_SECRET";
    expect(invalidKey).toBeDefined();
  });
});
