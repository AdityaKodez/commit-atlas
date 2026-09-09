import Image from "next/image";
import { DeltaChip } from "@/components/delta-chip";
import { Heatmap } from "@/components/heatmap";
import { LinesChart } from "@/components/lines-chart";
import { Punchcard } from "@/components/punchcard";
import { fmtInt, formatMonthDay } from "@/lib/format";
import type { Profile } from "@/lib/github";
import {
  type CalendarCell,
  type LinesDay,
  type Streaks,
} from "@/lib/stats";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type PeakHour = { day: string; hour: number; count: number };

/** Busiest weekday-hour cell of the punchcard (rows Mon-first, cols local hours). */
function peakHour(grid: number[][]): PeakHour | null {
  let best: { wd: number; hour: number; count: number } | null = null;
  for (let wd = 0; wd < grid.length; wd++) {
    for (let hour = 0; hour < grid[wd].length; hour++) {
      const count = grid[wd][hour];
      if (count > 0 && (!best || count > best.count)) {
        best = { wd, hour, count };
      }
    }
  }
  return best ? { day: DAY_NAMES[best.wd], hour: best.hour, count: best.count } : null;
}

/** The single day with the most commits. */
function busiestDay(weeks: CalendarCell[][]): CalendarCell | null {
  let best: CalendarCell | null = null;
  for (const week of weeks) {
    for (const cell of week) {
      if (!cell.future && (!best || cell.count > best.count)) best = cell;
    }
  }
  return best;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export type ProfileSummary = {
  commits48: number;
  commits14: number;
  previous48: number;
  /** Present only when every commit in the window reported line stats. */
  lines: { additions: number; deletions: number } | null;
  perRepo: Array<{ slug: string; name: string; count: number }>;
  weeks: CalendarCell[][];
  streaks: Streaks;
  punchcard: number[][];
  linesDays: LinesDay[];
  linesComplete: boolean;
};

export function ProfileCard({
  profile,
  summary,
}: {
  profile: Profile;
  summary: ProfileSummary;
}) {
  const peak = peakHour(summary.punchcard);
  const topDay = busiestDay(summary.weeks);

  return (
    <section
      id="profile"
      aria-label="Your profile"
      className="py-12 sm:py-14"
    >
      <div className="flex flex-wrap items-center gap-5">
        <Image
          src={profile.avatarUrl}
          alt={`${profile.login} avatar`}
          width={80}
          height={80}
          className="size-16 rounded-full ring-2 ring-border sm:size-20"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {profile.name ?? profile.login}
          </h1>
          <p className="text-sm text-muted-foreground">
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              @{profile.login}
            </a>
            <span> · Commit Atlas</span>
          </p>
          {profile.bio && (
            <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-6xl font-extrabold leading-none tracking-tight text-chart-1 tabular-nums sm:text-7xl">
              {fmtInt(summary.commits48)}
            </span>
            <DeltaChip current={summary.commits48} previous={summary.previous48} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            your commits, last 48 hours
          </p>
        </div>
        <div>
          <div className="text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">
            {fmtInt(summary.commits14)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            in the last 14 days
          </p>
        </div>
        <div>
          <div className="text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">
            {summary.lines ? (
              <>
                <span className="text-chart-1">
                  +{fmtInt(summary.lines.additions)}
                </span>{" "}
                <span className="text-zinc-500">
                  −{fmtInt(summary.lines.deletions)}
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            lines added / removed, last 14 days
            {!summary.lines && " (unavailable)"}
          </p>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold sm:text-base">
            Commit activity, last 6 months
          </h3>
          <p className="text-xs text-muted-foreground sm:text-sm">
            current streak{" "}
            <span className="font-semibold text-chart-1 tabular-nums">
              {fmtInt(summary.streaks.current)}d
            </span>
            {" · "}
            longest{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {fmtInt(summary.streaks.longest)}d
            </span>
          </p>
        </div>
        {topDay && topDay.count > 0 && (
          <p className="mt-2 text-sm">
            Your biggest day was{" "}
            <span className="font-semibold text-chart-1">
              {formatMonthDay(topDay.date)}
            </span>{" "}
            with{" "}
            <span className="font-semibold text-chart-1 tabular-nums">
              {fmtInt(topDay.count)}
            </span>{" "}
            {topDay.count === 1 ? "commit" : "commits"}.
          </p>
        )}
        <div className="mt-4">
          <Heatmap weeks={summary.weeks} />
        </div>
      </div>

      <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold sm:text-base">
            Lines per day, last 14 days
          </h3>
          {!summary.linesComplete && (
            <p className="mt-1 text-xs text-muted-foreground">
              Line stats unavailable for some commits in this window.
            </p>
          )}
          <div className="mt-4">
            {summary.linesComplete ? (
              <LinesChart days={summary.linesDays} />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Not enough line data
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold sm:text-base">
            When do you code
          </h3>
          {peak && (
            <p className="mt-2 text-sm">
              You commit the most on{" "}
              <span className="font-semibold text-chart-1">{peak.day}s</span>{" "}
              around{" "}
              <span className="font-semibold text-chart-1">
                {pad2(peak.hour)}:00–{pad2((peak.hour + 1) % 24)}:00
              </span>{" "}
              — {fmtInt(peak.count)}{" "}
              {peak.count === 1 ? "commit" : "commits"} in that hour.
            </p>
          )}
          <div className="mt-4">
            <Punchcard grid={summary.punchcard} />
          </div>
        </div>
      </div>
    </section>
  );
}
