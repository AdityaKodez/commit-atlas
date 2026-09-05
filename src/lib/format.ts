const monthDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "2-digit",
});

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "Sep 03" */
export function utcMonthDay(input: Date | number | string): string {
  return monthDay.format(new Date(input));
}

/** "03:35" */
export function utcTime(input: Date | number | string): string {
  return time.format(new Date(input));
}

/** "Sep 01 03:35" */
export function utcMonthDayTime(input: Date | number | string): string {
  return `${utcMonthDay(input)} ${utcTime(input)}`;
}

/** Integer with thousands separators. */
export function fmtInt(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value,
  );
}
