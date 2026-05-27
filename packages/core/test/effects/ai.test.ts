import { describe, it, expect } from "vitest";
import { createAIContext } from "../../src/effects/primitives/ai";
import { createInterceptorMock } from "../helpers/interceptor-mock";

describe("createAIContext", () => {
  it("should call ai.generate with prompt and schema", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const ai = createAIContext(interceptEffect);
    const result = await ai.generate({ prompt: "hello" });
    expect(calls[0]).toMatchObject({ type: "ai.generate", payload: { prompt: "hello", tier: "low" } });
    expect(result).toBeUndefined();
  });

  it("should call ai.classify and map input/labels to prompt/classes", async () => {
    const { interceptEffect, calls } = createInterceptorMock();
    const ai = createAIContext(interceptEffect);
    await ai.classify({ input: "test", labels: ["a", "b"] });
    expect(calls[0]).toMatchObject({
      type: "ai.classify",
      payload: { input: "test", tier: "low", classes: ["a", "b"] },
    });
  });

  it("should call ai.stream and yield text", async () => {
    const { interceptEffect } = createInterceptorMock({
      "ai.stream": () => "streamed result",
    });
    const ai = createAIContext(interceptEffect);
    const gen = ai.stream({ prompt: "hello" });
    const chunks = [];
    for await (const chunk of gen) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["streamed result"]);
  });
});
