const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
});

const time = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "Sep 03" in local timezone */
export function formatMonthDay(input: Date | number | string): string {
  return monthDay.format(new Date(input));
}

/** "03:35" in local timezone */
export function formatTime(input: Date | number | string): string {
  return time.format(new Date(input));
}

/** "Sep 01 03:35" in local timezone */
export function formatMonthDayTime(input: Date | number | string): string {
  return `${formatMonthDay(input)} ${formatTime(input)}`;
}

/** Aliases for compatibility */
export const utcMonthDay = formatMonthDay;
export const utcTime = formatTime;
export const utcMonthDayTime = formatMonthDayTime;

const intFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Integer with thousands separators. */
export function fmtInt(value: number): string {
  return intFormatter.format(value);
}
