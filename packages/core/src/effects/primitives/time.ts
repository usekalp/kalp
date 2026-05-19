import type { KalpTime, TimezoneFormatter, IanaTimezone, Duration } from "@kalphq/sdk";
import { toMs } from "@kalphq/sdk";

const tzFormatters = new Map<string, Intl.DateTimeFormat>();

function getTzFormatter(tz: string): Intl.DateTimeFormat {
  const cached = tzFormatters.get(tz);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  tzFormatters.set(tz, fmt);
  return fmt;
}

/**
 * Create the time primitive pinned to a fixed base timestamp, providing date arithmetic,
 * ISO formatting, comparison, and timezone-aware formatting.
 *
 * @param baseTime - The fixed base timestamp in milliseconds since epoch.
 */
export function createTimeContext(baseTime: number): KalpTime {
  return {
    now: () => baseTime,

    toISOString: (timestamp?: number) => new Date(timestamp ?? baseTime).toISOString(),

    isAfter: (iso: string) => baseTime > new Date(iso).getTime(),

    isBefore: (iso: string) => baseTime < new Date(iso).getTime(),

    add: (dur: Duration) => baseTime + toMs(dur),

    sub: (dur: Duration) => baseTime - toMs(dur),

    timezone: (tz: IanaTimezone): TimezoneFormatter => ({
      format: (fmt: string) => {
        const date = new Date(baseTime);
        const tzDate = date.toLocaleString("en-US", { timeZone: tz });
        const tzMs = new Date(tzDate).getTime();
        const diff = tzMs - date.getTime();
        const adjusted = baseTime + diff;
        const adjustedDate = new Date(adjusted);

        const map: Record<string, string> = {
          YYYY: String(adjustedDate.getUTCFullYear()),
          MM: String(adjustedDate.getUTCMonth() + 1).padStart(2, "0"),
          DD: String(adjustedDate.getUTCDate()).padStart(2, "0"),
          HH: String(adjustedDate.getUTCHours()).padStart(2, "0"),
          mm: String(adjustedDate.getUTCMinutes()).padStart(2, "0"),
          ss: String(adjustedDate.getUTCSeconds()).padStart(2, "0"),
        };

        let result = fmt;
        for (const [token, value] of Object.entries(map)) {
          result = result.replace(token, value);
        }
        return result;
      },
      toISOString: () => {
        if (tz === "UTC" || tz === "GMT") {
          return new Date(baseTime).toISOString();
        }
        const formatter = getTzFormatter(tz);
        const parts = formatter.formatToParts(new Date(baseTime));
        const map = new Map(parts.map((p) => [p.type, p.value]));

        const year = map.get("year") ?? "1970";
        const month = (map.get("month") ?? "01").padStart(2, "0");
        const day = (map.get("day") ?? "01").padStart(2, "0");
        const hour = (map.get("hour") ?? "00").padStart(2, "0");
        const minute = (map.get("minute") ?? "00").padStart(2, "0");
        const second = map.get("second") ?? "00";

        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      },
    }),
  };
}
