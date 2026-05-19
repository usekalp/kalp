import type { KalpLog } from "@kalphq/sdk";
import type { SyncInterceptor } from "./types";

/**
 * Create the log primitive for structured logging at debug, info, warn, and error levels.
 * Each method records a synchronous effect for replay while emitting the log entry.
 *
 * @param interceptSync - Synchronous effect interceptor for routing log calls through the effect pipeline.
 */
export function createLogContext(interceptSync: SyncInterceptor): KalpLog {
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      interceptSync("log.debug", { message, meta }, () => {}),
    info: (message: string, meta?: Record<string, unknown>) =>
      interceptSync("log.info", { message, meta }, () => {}),
    warn: (message: string, meta?: Record<string, unknown>) =>
      interceptSync("log.warn", { message, meta }, () => {}),
    error: (error: Error | string, meta?: Record<string, unknown>) =>
      interceptSync(
        "log.error",
        { message: error instanceof Error ? error.message : error, meta },
        () => {},
      ),
  };
}
