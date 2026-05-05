/**
 * Log primitive interface for structured observability.
 *
 * @module
 */

/** Log entry severity level */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log primitive for identity-aware structured logging.
 * Logs are persisted to the execution log and indexed by agent, user, and time.
 *
 * Note: This is a pure interface - actual log persistence is handled by the runtime.
 */
export interface KalpLog {
  /**
   * Log an informational message.
   * @param message - The log message.
   * @param meta - Optional structured metadata.
   */
  info: (message: string, meta?: Record<string, unknown>) => void;

  /**
   * Log a warning message.
   * @param message - The warning message.
   * @param meta - Optional structured metadata.
   */
  warn: (message: string, meta?: Record<string, unknown>) => void;

  /**
   * Log an error.
   * @param error - The error or error message.
   * @param meta - Optional structured metadata.
   */
  error: (error: Error | string, meta?: Record<string, unknown>) => void;

  /**
   * Log a debug message (development only, may be filtered in production).
   * @param message - The debug message.
   * @param meta - Optional structured metadata.
   */
  debug: (message: string, meta?: Record<string, unknown>) => void;
}
