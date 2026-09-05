import { cn } from "cn";
import { BarcodePlot } from "@/components/barcode-plot";
import { DeltaChip } from "@/components/delta-chip";
import { DotMatrix } from "@/components/dot-matrix";
import { HourlyBars } from "@/components/hourly-bars";
import { RollingChart } from "@/components/rolling-chart";
import { StatsRow } from "@/components/stats-row";
import { fmtInt, utcMonthDayTime, utcTime } from "@/lib/format";
import { repoFullName, repoSlug, type RepoConfig } from "@/lib/repos";
import {
  countInWindow,
  HOUR_MS,
  WINDOW_HOURS,
  type RepoStats,
} from "@/lib/stats";
import type { Commit } from "@/lib/github";

const CURRENT_COLS = 13;
const BASELINE_COLS = 10;

export function RepoPanel({
  name,
  config,
  commits,
  stale,
  stats,
  first = false,
}: {
  name: string;
  config: RepoConfig;
  commits: Commit[];
  stale: boolean;
  stats: RepoStats;
  first?: boolean;
}) {
  const {
    windowStart,
    windowEnd,
    windowCount,
    median,
    mean,
    p75,
    p90,
    max,
    ratio,
    pctWindowsReached,
    busiest,
  } = stats;
  const medianInt = Math.round(median);
  const times = commits.map((c) => Date.parse(c.committedAt));
  const previous48 = countInWindow(
    times,
    windowStart - WINDOW_HOURS * HOUR_MS,
    windowStart,
  );

  const windowCommits = commits
    .map((c) => ({ ...c, t: Date.parse(c.committedAt) }))
    .filter((c) => c.t >= windowStart && c.t <= windowEnd)
    .sort((a, b) => a.t - b.t)
    .map((c) => ({ ...c, pct: ((c.t - windowStart) / (windowEnd - windowStart)) * 100 }));

  return (
    <section
      id={repoSlug(config)}
      aria-label={name}
      className={cn(
        "scroll-mt-16 py-14 sm:py-16",
        !first && "border-t border-border/60",
      )}
    >
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
        {name} pushed {fmtInt(windowCount)}{" "}
        {windowCount === 1 ? "commit" : "commits"} in the last 48 hours
      </h2>
      <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
        Window: {utcMonthDayTime(windowStart)} to {utcMonthDayTime(windowEnd)}{" "}
        UTC. Baseline: every hourly rolling 48h window over the 14 days before
        that ({fmtInt(stats.baselineWindows)} windows). Source: GitHub commits
        on {repoFullName(config)}.
        {stale && " Showing a cached snapshot — live fetch failed."}
      </p>

      <div className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-8 sm:mt-12 sm:gap-x-14">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-7xl font-extrabold leading-none tracking-tight text-chart-1 tabular-nums sm:text-8xl">
              {fmtInt(windowCount)}
            </span>
            <DeltaChip current={windowCount} previous={previous48} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            committed, last 48 hours
          </p>
        </div>
        <p className="pb-8 text-lg text-muted-foreground sm:pb-12 sm:text-xl">
          vs
        </p>
        <div>
          <div className="text-7xl font-extrabold leading-none tracking-tight text-zinc-500 tabular-nums sm:text-8xl">
            {fmtInt(medianInt)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            median 48h window, last 14 days
          </p>
        </div>
        <div>
          <div className="text-5xl font-bold leading-none tracking-tight tabular-nums sm:text-6xl">
            {ratio !== null ? `${ratio.toFixed(1)}x` : "—"}
          </div>
          <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
            the usual rate
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-8 sm:mt-12 sm:flex-row sm:items-start sm:gap-12">
        <div className="w-full max-w-[20rem] sm:max-w-[26rem]">
          <DotMatrix count={windowCount} tone="current" columns={CURRENT_COLS} />
          <p className="mt-3 text-xs text-chart-1">
            {fmtInt(windowCount)} committed in the last 48 hours
          </p>
        </div>
        <div className="w-full max-w-[16rem] sm:max-w-[17rem]">
          <DotMatrix count={medianInt} tone="baseline" columns={BASELINE_COLS} />
          <p className="mt-3 text-xs text-muted-foreground">
            {fmtInt(medianInt)} in a typical 48 hours (median)
          </p>
        </div>
      </div>

      <div className="mt-12 sm:mt-14">
        <StatsRow
          items={[
            { value: mean.toFixed(1), label: "mean per 48h window" },
            { value: fmtInt(Math.round(p75)), label: "p75" },
            { value: fmtInt(Math.round(p90)), label: "p90" },
            { value: fmtInt(max), label: "max" },
            {
              value: pctWindowsReached ? `${pctWindowsReached.pct}%` : "—",
              label: pctWindowsReached
                ? `of windows reached ${fmtInt(windowCount)}+ (${fmtInt(pctWindowsReached.hits)} of ${fmtInt(pctWindowsReached.of)})`
                : "no commits in the current window",
            },
          ]}
        />
      </div>

      <div className="mt-14 sm:mt-16">
        <h3 className="text-sm font-semibold sm:text-base">When they landed</h3>
        <div className="mt-6">
          <BarcodePlot commits={windowCommits} />
          <HourlyBars stats={stats} />
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span key={f}>
                {f === 0
                  ? utcMonthDayTime(windowStart)
                  : utcTime(windowStart + f * WINDOW_HOURS * HOUR_MS)}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-5 text-muted-foreground">
          Each line is one commit — hover it for the message, click to open on
          GitHub. Each shaded bar counts the commits that landed in that hour —
          hover a bar for the exact time range.
          {busiest &&
            ` The busiest hour was ${utcTime(busiest.start)} to ${utcTime(busiest.end)} UTC with ${fmtInt(busiest.count)} ${busiest.count === 1 ? "commit" : "commits"}.`}
        </p>
      </div>

      <div className="mt-14 sm:mt-16">
        <h3 className="text-sm font-semibold sm:text-base">
          Rolling 48h commit count, last 14 days
        </h3>
        <RollingChart stats={stats} />
        <p className="mt-3 max-w-2xl text-xs leading-5 text-muted-foreground">
          Each point counts the commits made in the 48 hours before it — hover
          anywhere on the line to see the exact count and period. The orange dot
          is the current window.
        </p>
      </div>
    </section>
  );
}
