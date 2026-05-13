import type { IanaTimezone } from "@/schedule/timezones";

export type CronExpression =
  `${string} ${string} ${string} ${string} ${string}`;

export type CronHour =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23;

export type CronMinute =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32
  | 33
  | 34
  | 35
  | 36
  | 37
  | 38
  | 39
  | 40
  | 41
  | 42
  | 43
  | 44
  | 45
  | 46
  | 47
  | 48
  | 49
  | 50
  | 51
  | 52
  | 53
  | 54
  | 55
  | 56
  | 57
  | 58
  | 59;

export interface CronSchedule {
  expression: CronExpression;
  timezone?: IanaTimezone;
}

export function cron<const TExpression extends CronExpression>(
  expression: TExpression,
): TExpression {
  return expression;
}

export function everyDayAt(
  hour: CronHour,
  minute: CronMinute = 0,
): CronExpression {
  return `${minute} ${hour} * * *` as CronExpression;
}

export function everyWeekdayAt(
  hour: CronHour,
  minute: CronMinute = 0,
): CronExpression {
  return `${minute} ${hour} * * 1-5` as CronExpression;
}

export function everyXMinutes(step: 1 | 5 | 10 | 15 | 20 | 30): CronExpression {
  return `*/${step} * * * *` as CronExpression;
}

export const everyMinute = cron("* * * * *");
export const everyHour = cron("0 * * * *");
export const everySixHours = cron("0 */6 * * *");
export const everyDayAtMidnight = cron("0 0 * * *");
export const everyDayAtNoon = cron("0 12 * * *");
export const everyDayAt12Pm = everyDayAtNoon;
export const everyWeekdayAt9Am = cron("0 9 * * 1-5");
export const everySundayAt3Am = cron("0 3 * * 0");
