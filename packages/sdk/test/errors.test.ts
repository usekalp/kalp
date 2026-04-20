import { describe, expect, it } from "vitest";
import {
  KalpAIProviderError,
  KalpAuthError,
  KalpConfigurationError,
  KalpError,
  KalpMemoryError,
  KalpRateLimitError,
  KalpStorageError,
  KalpTimeoutError,
  KalpValidationError,
  KalpWaitError,
  isKalpError,
  normalizeKalpError,
} from "../src/errors";

describe("errors", () => {
  it("maps validation contract", () => {
    const err = new KalpValidationError("Invalid payload", {
      field: "agentId",
    });
    expect(err.name).toBe("KalpValidationError");
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.status).toBe(400);
    expect(err.retryable).toBe(false);
    expect(err.details).toEqual({ field: "agentId" });
  });

  it("defaults configuration errors to missing credentials", () => {
    const err = new KalpConfigurationError("Missing provider key");
    expect(err.code).toBe("MISSING_CREDENTIALS");
    expect(err.status).toBe(400);
    expect(err.retryable).toBe(false);
  });

  it("chooses auth status by code", () => {
    const unauthorized = new KalpAuthError("Bad token", "INVALID_CREDENTIALS");
    const forbidden = new KalpAuthError("Forbidden", "FORBIDDEN");
    expect(unauthorized.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it("marks retryable runtime errors", () => {
    expect(new KalpRateLimitError().retryable).toBe(true);
    expect(new KalpTimeoutError().retryable).toBe(true);
    expect(new KalpAIProviderError("Provider unavailable").retryable).toBe(
      true,
    );
    expect(new KalpMemoryError("Could not read memory").retryable).toBe(true);
    expect(new KalpStorageError("KV failure").retryable).toBe(true);
  });

  it("marks wait error as non-retryable", () => {
    const err = new KalpWaitError("wait failed");
    expect(err.code).toBe("WAIT_ERROR");
    expect(err.status).toBe(500);
    expect(err.retryable).toBe(false);
  });

  it("narrows with isKalpError", () => {
    expect(isKalpError(new KalpError({ code: "UNKNOWN", message: "x" }))).toBe(
      true,
    );
    expect(isKalpError(new Error("x"))).toBe(false);
    expect(isKalpError({})).toBe(false);
  });

  it("normalizes runtime errors", () => {
    const internal = normalizeKalpError(new Error("boom"));
    expect(internal.code).toBe("INTERNAL_ERROR");
    expect(internal.status).toBe(500);
    expect(internal.message).toBe("boom");

    const unknown = normalizeKalpError("explode");
    expect(unknown.code).toBe("UNKNOWN");
    expect(unknown.status).toBe(500);
  });
});
