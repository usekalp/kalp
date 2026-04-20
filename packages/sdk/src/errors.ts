export type KalpErrorCode =
  | "UNKNOWN"
  | "INVALID_INPUT"
  | "INVALID_MODEL_ID"
  | "UNSUPPORTED_MODEL"
  | "MISSING_CREDENTIALS"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "MEMORY_ERROR"
  | "MEMORY_SUMMARIZATION_ERROR"
  | "STORAGE_ERROR"
  | "WAIT_ERROR"
  | "INTERNAL_ERROR";

export interface KalpErrorOptions {
  code: KalpErrorCode;
  message: string;
  status?: number;
  retryable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class KalpError extends Error {
  readonly code: KalpErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(options: KalpErrorOptions) {
    super(options.message);
    this.name = "KalpError";
    this.code = options.code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;
  }

  toJSON(): {
    name: string;
    code: KalpErrorCode;
    message: string;
    status: number;
    retryable: boolean;
    details?: Record<string, unknown>;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export class KalpValidationError extends KalpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: "INVALID_INPUT",
      message,
      status: 400,
      retryable: false,
      details,
    });
    this.name = "KalpValidationError";
  }
}

export class KalpConfigurationError extends KalpError {
  constructor(
    message: string,
    code: "INVALID_MODEL_ID" | "UNSUPPORTED_MODEL" | "MISSING_CREDENTIALS" =
      "MISSING_CREDENTIALS",
    details?: Record<string, unknown>,
  ) {
    super({
      code,
      message,
      status: 400,
      retryable: false,
      details,
    });
    this.name = "KalpConfigurationError";
  }
}

export class KalpAuthError extends KalpError {
  constructor(
    message: string,
    code: "INVALID_CREDENTIALS" | "FORBIDDEN" = "INVALID_CREDENTIALS",
    details?: Record<string, unknown>,
  ) {
    super({
      code,
      message,
      status: code === "FORBIDDEN" ? 403 : 401,
      retryable: false,
      details,
    });
    this.name = "KalpAuthError";
  }
}

export class KalpNotFoundError extends KalpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: "NOT_FOUND",
      message,
      status: 404,
      retryable: false,
      details,
    });
    this.name = "KalpNotFoundError";
  }
}

export class KalpRateLimitError extends KalpError {
  constructor(message = "Rate limit exceeded", details?: Record<string, unknown>) {
    super({
      code: "RATE_LIMITED",
      message,
      status: 429,
      retryable: true,
      details,
    });
    this.name = "KalpRateLimitError";
  }
}

export class KalpTimeoutError extends KalpError {
  constructor(message = "Operation timed out", details?: Record<string, unknown>) {
    super({
      code: "TIMEOUT",
      message,
      status: 408,
      retryable: true,
      details,
    });
    this.name = "KalpTimeoutError";
  }
}

export class KalpAIProviderError extends KalpError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super({
      code: "AI_PROVIDER_ERROR",
      message,
      status: 502,
      retryable: true,
      details,
      cause,
    });
    this.name = "KalpAIProviderError";
  }
}

export class KalpMemoryError extends KalpError {
  constructor(
    message: string,
    code: "MEMORY_ERROR" | "MEMORY_SUMMARIZATION_ERROR" = "MEMORY_ERROR",
    details?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super({
      code,
      message,
      status: 500,
      retryable: true,
      details,
      cause,
    });
    this.name = "KalpMemoryError";
  }
}

export class KalpStorageError extends KalpError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super({
      code: "STORAGE_ERROR",
      message,
      status: 500,
      retryable: true,
      details,
      cause,
    });
    this.name = "KalpStorageError";
  }
}

export class KalpWaitError extends KalpError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super({
      code: "WAIT_ERROR",
      message,
      status: 500,
      retryable: false,
      details,
      cause,
    });
    this.name = "KalpWaitError";
  }
}

export function isKalpError(value: unknown): value is KalpError {
  return value instanceof KalpError;
}

export function normalizeKalpError(error: unknown): KalpError {
  if (isKalpError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new KalpError({
      code: "INTERNAL_ERROR",
      message: error.message,
      status: 500,
      retryable: false,
      cause: error,
    });
  }

  return new KalpError({
    code: "UNKNOWN",
    message: "Unknown runtime error",
    status: 500,
    retryable: false,
    details: { error },
  });
}
