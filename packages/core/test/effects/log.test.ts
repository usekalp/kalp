import { describe, it, expect } from "vitest";
import { createLogContext } from "../../src/effects/primitives/log";
import { createInterceptorMock } from "../helpers/interceptor-mock";

describe("createLogContext", () => {
  it("should log at info level via sync interceptor", () => {
    const { interceptSync, calls } = createInterceptorMock();
    const log = createLogContext(interceptSync);
    log.info("hello world");
    expect(calls[0]).toMatchObject({ type: "log.info", payload: { message: "hello world", meta: undefined } });
  });

  it("should log at warn level with data", () => {
    const { interceptSync, calls } = createInterceptorMock();
    const log = createLogContext(interceptSync);
    log.warn("warning", { code: 123 });
    expect(calls[0]).toMatchObject({ type: "log.warn", payload: { message: "warning", meta: { code: 123 } } });
  });

  it("should log at error level", () => {
    const { interceptSync, calls } = createInterceptorMock();
    const log = createLogContext(interceptSync);
    log.error("error occurred");
    expect(calls[0]).toMatchObject({ type: "log.error", payload: { message: "error occurred", meta: undefined } });
  });

  it("should log at debug level", () => {
    const { interceptSync, calls } = createInterceptorMock();
    const log = createLogContext(interceptSync);
    log.debug("debug info");
    expect(calls[0]).toMatchObject({ type: "log.debug", payload: { message: "debug info", meta: undefined } });
  });
});
