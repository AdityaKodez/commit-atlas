/**
 * Pure window-math for the dashboard, mirroring the reference layout:
 *
 * - Current window: the trailing 48 hours ending at `now`.
 * - Baseline: every hourly rolling 48h window ending in the 14 days *before*
 *   the current window started (14 * 24 + 1 = 337 windows), giving the
 *   median / p75 / p90 / mean / max and the "% of windows reached" stat.
 * - Rolling series: the trailing 48h commit count sampled every hour over the
 *   last 14 days, ending at `now` (its last point is the current window).
 *
 * All inputs/outputs are UTC epoch milliseconds.
 */

export const HOUR_MS = 3_600_000;
export const WINDOW_HOURS = 48;
export const BASELINE_DAYS = 14;
export const BASELINE_WINDOWS = BASELINE_DAYS * 24 + 1; // 337

export type SeriesPoint = { t: number; count: number };

export type DayBucket = { start: number; end: number; count: number };

/** Author-match shapes shared with the GitHub layer. */
export type AuthorRef = { author: string; authorLogin: string | null };
export type ProfileRef = { login: string; name: string | null };

/**
 * A commit is "mine" when GitHub attributes it to the profile's account, or
 * (for unlinked commits) when the git author name equals the profile name.
 */
export function isMine(commit: AuthorRef, profile: ProfileRef): boolean {
  if (commit.authorLogin) {
    return commit.authorLogin.toLowerCase() === profile.login.toLowerCase();
  }
  return !!profile.name && commit.author === profile.name;
}

/** `days` rolling 24h buckets ending at `now`. */
export function dailyBuckets(
  times: number[],
  now: number,
  days: number,
): DayBucket[] {
  const sorted = [...times].sort((a, b) => a - b);
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const end = now - i * 24 * HOUR_MS;
    const start = end - 24 * HOUR_MS;
    buckets.push({ start, end, count: countIn(sorted, start, end) });
  }
  return buckets;
}

export const DAY_MS = 24 * HOUR_MS;

/** Count of values with start <= t < end (convenience wrapper). */
export function countInWindow(times: number[], start: number, end: number): number {
  return countIn([...times].sort((a, b) => a - b), start, end);
}

export type CalendarCell = {
  /** Local midnight of the day. */
  date: number;
  count: number;
  /** Cells after today are rendered as invisible spacers. */
  future: boolean;
};

/** Weeks of 7 cells (Sun..Sat, GitHub-style), last week ends today, aligned to local calendar days. */
export function calendarWeeks(
  times: number[],
  now: number,
  days: number,
): CalendarCell[][] {
  const sorted = [...times].sort((a, b) => a - b);
  const nowDate = new Date(now);
  const todayStart = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();

  const startDate = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate() - (days - 1),
  );
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: CalendarCell[][] = [];
  const curr = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );

  while (curr.getTime() <= todayStart) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const cellStart = new Date(
        curr.getFullYear(),
        curr.getMonth(),
        curr.getDate(),
      ).getTime();
      const nextDay = new Date(
        curr.getFullYear(),
        curr.getMonth(),
        curr.getDate() + 1,
      ).getTime();

      const future = cellStart > todayStart;
      const count = future ? 0 : countIn(sorted, cellStart, nextDay);

      week.push({
        date: cellStart,
        count,
        future,
      });

      curr.setDate(curr.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export type Streaks = { current: number; longest: number };

function toLocalDayStart(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function prevLocalDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime();
}

/** Consecutive local calendar-day streaks. Current streak ends today (or yesterday). */
export function streaks(times: number[], now: number): Streaks {
  const daySet = new Set(times.map(toLocalDayStart));
  const today = toLocalDayStart(now);
  const yesterday = prevLocalDay(today);

  let current = 0;
  let cursor: number | null = daySet.has(today)
    ? today
    : daySet.has(yesterday)
      ? yesterday
      : null;

  while (cursor !== null && daySet.has(cursor)) {
    current += 1;
    cursor = prevLocalDay(cursor);
  }

  const sortedDays = Array.from(daySet).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev = NaN;
  for (const day of sortedDays) {
    if (run > 0 && prevLocalDay(day) === prev) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = day;
  }

  return { current, longest };
}

/** 7×24 matrix of commit counts; rows Monday-first, cols local hours. */
export function hourWeekday(times: number[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const t of times) {
    const d = new Date(t);
    const mondayFirstDay = (d.getDay() + 6) % 7;
    grid[mondayFirstDay][d.getHours()] += 1;
  }
  return grid;
}

export type LinesDay = {
  start: number;
  end: number;
  additions: number;
  deletions: number;
};

/** `days` calendar daily buckets of line counts (commits without stats are skipped). */
export function linesDaily(
  commitStats: Array<{ t: number; additions: number; deletions: number }>,
  now: number,
  days: number,
): LinesDay[] {
  const nowDate = new Date(now);
  const startDate = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate() - (days - 1),
  );

  const buckets: LinesDay[] = [];
  const curr = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );

  for (let i = 0; i < days; i++) {
    const start = new Date(
      curr.getFullYear(),
      curr.getMonth(),
      curr.getDate(),
    ).getTime();
    const end = new Date(
      curr.getFullYear(),
      curr.getMonth(),
      curr.getDate() + 1,
    ).getTime();

    buckets.push({
      start,
      end,
      additions: 0,
      deletions: 0,
    });

    curr.setDate(curr.getDate() + 1);
  }

  for (const c of commitStats) {
    for (const b of buckets) {
      if (c.t >= b.start && c.t < b.end) {
        b.additions += c.additions;
        b.deletions += c.deletions;
        break;
      }
    }
  }

  return buckets;
}

export type BusiestHour = { start: number; end: number; count: number };

export type RepoStats = {
  now: number;
  windowStart: number;
  windowEnd: number;
  /** Commits in the current 48h window. */
  windowCount: number;
  baselineWindows: number;
  baselineStart: number;
  median: number;
  p75: number;
  p90: number;
  mean: number;
  max: number;
  /** windowCount / median, or null when the baseline median is 0. */
  ratio: number | null;
  /** "% of baseline windows that reached the current count", or null when there are no commits. */
  pctWindowsReached: { pct: string; hits: number; of: number } | null;
  /** Commits per hour across the current window (48 buckets). */
  hourly: number[];
  busiest: BusiestHour | null;
  /** Hourly trailing-48h counts ending at `now`. */
  series: SeriesPoint[];
  /** Peak of the series excluding the final (current) point. */
  seriesMaxPoint: SeriesPoint | null;
  /** Nice ceiling for the rolling chart's y axis. */
  yMax: number;
};

function lowerBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Count of values with lo <= t < hi. */
function countIn(sorted: number[], lo: number, hi: number): number {
  return lowerBound(sorted, hi) - lowerBound(sorted, lo);
}

/** Linear-interpolation percentile over a sorted array. */
function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Smaller step values give the chart headroom for the "now" point, like the reference. */
function niceYMax(value: number): number {
  const safe = Math.max(0, value);
  const steps = [10, 20, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 2000, 5000];
  for (const step of steps) {
    if (step >= safe * 1.5) return step;
  }
  return Math.ceil((safe * 1.5) / 1000) * 1000;
}

export function computeStats(times: number[], now: number): RepoStats {
  const sorted = [...times].sort((a, b) => a - b);

  const windowEnd = now;
  const windowStart = now - WINDOW_HOURS * HOUR_MS;
  const baselineStart = windowStart - BASELINE_DAYS * 24 * HOUR_MS;
  const windowCount = countIn(sorted, windowStart, windowEnd);

  const baselineCounts: number[] = [];
  for (let i = 0; i < BASELINE_WINDOWS; i++) {
    const end = windowStart - i * HOUR_MS;
    baselineCounts.push(countIn(sorted, end - WINDOW_HOURS * HOUR_MS, end));
  }
  const sortedCounts = [...baselineCounts].sort((a, b) => a - b);
  const median = percentile(sortedCounts, 0.5);
  const p75 = percentile(sortedCounts, 0.75);
  const p90 = percentile(sortedCounts, 0.9);
  const mean =
    baselineCounts.reduce((sum, c) => sum + c, 0) / BASELINE_WINDOWS;
  const max = Math.max(0, ...baselineCounts);

  const series: SeriesPoint[] = [];
  for (let i = 0; i < BASELINE_WINDOWS; i++) {
    const t = now - (BASELINE_WINDOWS - 1 - i) * HOUR_MS;
    series.push({ t, count: countIn(sorted, t - WINDOW_HOURS * HOUR_MS, t) });
  }
  const prior = series.slice(0, -1);
  const seriesMaxPoint =
    prior.length > 0
      ? prior.reduce((best, p) => (p.count > best.count ? p : best), prior[0])
      : null;
  const yMax = niceYMax(seriesMaxPoint ? seriesMaxPoint.count : windowCount);

  const hourly = Array.from({ length: WINDOW_HOURS }, (_, i) =>
    countIn(
      sorted,
      windowStart + i * HOUR_MS,
      windowStart + (i + 1) * HOUR_MS,
    ),
  );
  const maxHour = Math.max(0, ...hourly);
  let busiest: BusiestHour | null = null;
  if (maxHour > 0) {
    const idx = hourly.indexOf(maxHour);
    busiest = {
      start: windowStart + idx * HOUR_MS,
      end: windowStart + (idx + 1) * HOUR_MS,
      count: maxHour,
    };
  }

  const ratio = median > 0 ? windowCount / median : null;
  const hits = baselineCounts.filter((c) => c >= windowCount).length;
  const pctWindowsReached =
    windowCount > 0
      ? {
          pct: ((hits / BASELINE_WINDOWS) * 100).toFixed(1),
          hits,
          of: BASELINE_WINDOWS,
        }
      : null;

  return {
    now,
    windowStart,
    windowEnd,
    windowCount,
    baselineWindows: BASELINE_WINDOWS,
    baselineStart,
    median,
    p75,
    p90,
    mean,
    max,
    ratio,
    pctWindowsReached,
    hourly,
    busiest,
    series,
    seriesMaxPoint,
    yMax,
  };
}
