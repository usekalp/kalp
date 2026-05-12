import { describe, expect, it } from "vitest";
import { extractFilePath } from "../src/utils/stack";

describe("extractFilePath", () => {
  it("extracts windows paths with drive letter", () => {
    const stack = `Error
    at something (C:\\Users\\devuser\\OneDrive\\Desktop\\Work\\kalp\\test-agents\\agents\\my-agent\\index.ts:12:8)
    at another (C:\\Users\\devuser\\OneDrive\\Desktop\\Work\\kalp\\packages\\sdk\\src\\definitions\\nodes.ts:20:2)`;

    expect(extractFilePath(stack)).toBe(
      "C:/Users/devuser/OneDrive/Desktop/Work/kalp/test-agents/agents/my-agent/index.ts",
    );
  });

  it("skips sdk listener frames and resolves caller file", () => {
    const stack = `Error
    at defineListener (C:\\Users\\devuser\\OneDrive\\Desktop\\Work\\kalp\\node_modules\\@kalphq\\sdk\\dist\\index.js:120:10)
    at Object.<anonymous> (C:\\Users\\devuser\\OneDrive\\Desktop\\Work\\kalp\\test-agents\\agents\\my-agent\\index.ts:14:26)`;

    expect(extractFilePath(stack)).toBe(
      "C:/Users/devuser/OneDrive/Desktop/Work/kalp/test-agents/agents/my-agent/index.ts",
    );
  });
});
