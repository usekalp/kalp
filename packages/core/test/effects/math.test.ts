import { describe, it, expect } from "vitest";
import { createMathContext } from "../../src/effects/primitives/math";
import { createInterceptorMock } from "../helpers/interceptor-mock";
import type { SyncInterceptor } from "../../src/effects/primitives/types";

const noopSync: SyncInterceptor = <T>(_type: string, _payload: unknown, compute: () => T): T => compute();

describe("createMathContext", () => {
  it("should compute abs", () => {
    const math = createMathContext(noopSync);
    expect(math.abs(-5)).toBe(5);
    expect(math.abs(3)).toBe(3);
  });

  it("should compute ceil", () => {
    const math = createMathContext(noopSync);
    expect(math.ceil(3.1)).toBe(4);
  });

  it("should compute floor", () => {
    const math = createMathContext(noopSync);
    expect(math.floor(3.9)).toBe(3);
  });

  it("should compute round", () => {
    const math = createMathContext(noopSync);
    expect(math.round(3.5)).toBe(4);
    expect(math.round(3.4)).toBe(3);
  });

  it("should compute max", () => {
    const math = createMathContext(noopSync);
    expect(math.max(1, 5, 3)).toBe(5);
  });

  it("should compute min", () => {
    const math = createMathContext(noopSync);
    expect(math.min(1, 5, 3)).toBe(1);
  });

  it("should compute pow", () => {
    const math = createMathContext(noopSync);
    expect(math.pow(2, 3)).toBe(8);
  });

  it("should compute sqrt", () => {
    const math = createMathContext(noopSync);
    expect(math.sqrt(9)).toBe(3);
  });

  it("should generate deterministic random via sync interceptor", () => {
    const { interceptSync } = createInterceptorMock();
    const math = createMathContext(interceptSync);
    const val = math.random();
    expect(typeof val).toBe("number");
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });
});
