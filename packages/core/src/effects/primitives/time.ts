import type { KalpTime, TimezoneFormatter } from "@kalphq/sdk";
import { toMs } from "@kalphq/sdk";
import type { Duration } from "@kalphq/sdk";

export function createTimeContext(baseTime: number): KalpTime {
  return {
    now: () => baseTime,
    toISOString: (timestamp?: number) => new Date(timestamp ?? baseTime).toISOString(),
    isAfter: (iso: string) => baseTime > new Date(iso).getTime(),
    isBefore: (iso: string) => baseTime < new Date(iso).getTime(),
    add: (dur: Duration) => baseTime + toMs(dur),
    sub: (dur: Duration) => baseTime - toMs(dur),
    timezone: (_tz: string): TimezoneFormatter => ({
      format: (_fmt: string) => new Date(baseTime).toISOString(),
      toISOString: () => new Date(baseTime).toISOString(),
    }),
  };
}
