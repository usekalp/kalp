import type { KalpDate } from "@kalphq/sdk";

export function createDateContext(baseTime: number): KalpDate {
  return {
    now: () => baseTime,
    toISOString: () => new Date(baseTime).toISOString(),
    isAfter: (iso: string) => baseTime > new Date(iso).getTime(),
    add: (dur: number | string) => {
      if (typeof dur === "number") return baseTime + dur;
      const match = dur.match(/^(\d+)([smhd])$/);
      if (!match) throw new Error(`Invalid duration format: ${dur}`);
      const v = parseInt(match[1]!, 10);
      const m = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]!];
      return baseTime + v * m!;
    },
    timezone: (_tz: string) => ({
      format: (_fmt: string) => new Date(baseTime).toISOString(), // Naive fallback
      toISOString: () => new Date(baseTime).toISOString(),
    }),
  };
}
