import { describe, expect, it } from "vitest";
import type { AIParams } from "../src";

describe("project-level type augmentations", () => {
  it("accepts valid openai model", () => {
    const params: AIParams = {
      prompt: "hello",
      model: "gpt-4o-mini",
    };

    expect(params.model).toBe("gpt-4o-mini");
  });

  it("AIParams model is a string", () => {
    const params: AIParams = {
      prompt: "hello",
      model: "some-model-name",
    };
    expect(typeof params.model).toBe("string");
  });
});
