import type { KalpLog } from "@kalphq/sdk";
import type { SyncInterceptor } from "./types";

export function createLogContext(interceptSync: SyncInterceptor): KalpLog {
  return {
    debug: (msg: string, data?: unknown) =>
      interceptSync("log.debug", { msg, data }, () => {}),
    info: (msg: string, data?: unknown) =>
      interceptSync("log.info", { msg, data }, () => {}),
    warn: (msg: string, data?: unknown) =>
      interceptSync("log.warn", { msg, data }, () => {}),
    error: (err: unknown, data?: unknown) =>
      interceptSync(
        "log.error",
        { err: err instanceof Error ? err.message : String(err), data },
        () => {},
      ),
  };
}
