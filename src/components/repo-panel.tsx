import { cn } from "cn";
import { BarcodePlot } from "@/components/barcode-plot";
import { DeltaChip } from "@/components/delta-chip";
import { HourlyBars } from "@/components/hourly-bars";
import { RollingChart } from "@/components/rolling-chart";
import { fmtInt, formatMonthDayTime, formatTime } from "@/lib/format";
import { repoSlug, type RepoConfig } from "@/lib/repos";
import {
  countInWindow,
  HOUR_MS,
  WINDOW_HOURS,
  type RepoStats,
} from "@/lib/stats";
import type { Commit } from "@/lib/github";

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
  const { windowStart, windowEnd, windowCount, median, ratio, busiest } = stats;
  const medianInt = Math.round(median);
  const times = commits.map((c) => Date.parse(c.committedAt));
  const previous48 = countInWindow(
    times,
    windowStart - WINDOW_HOURS * HOUR_MS,
    windowStart,
  );

  const windowCommits = commits
    .reduce<Array<Commit & { t: number; pct: number }>>((acc, c) => {
      const t = Date.parse(c.committedAt);
      if (t >= windowStart && t <= windowEnd) {
        const span = windowEnd - windowStart || 1;
        const pct = Math.min(100, Math.max(0, ((t - windowStart) / span) * 100));
        acc.push({ ...c, t, pct });
      }
      return acc;
    }, [])
    .sort((a, b) => a.t - b.t);

  return (
    <section
      id={repoSlug(config)}
      aria-label={name}
      className={cn("py-14 sm:py-16", !first && "border-t border-border/60")}
    >
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
        {name}
        {stale && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            cached
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {fmtInt(windowCount)} {windowCount === 1 ? "commit" : "commits"} in the
        last 48 hours
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

      <div className="mt-14 sm:mt-16">
        <h3 className="text-sm font-semibold sm:text-base">When they landed</h3>
        <div className="mt-6">
          <BarcodePlot commits={windowCommits} />
          <HourlyBars stats={stats} />
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span key={f}>
                {f === 0
                  ? formatMonthDayTime(windowStart)
                  : formatTime(windowStart + f * WINDOW_HOURS * HOUR_MS)}
              </span>
            ))}
          </div>
        </div>
        {busiest && (
          <p className="mt-3 text-sm">
            Busiest hour was{" "}
            <span className="font-semibold text-chart-1">
              {formatTime(busiest.start)} to {formatTime(busiest.end)}
            </span>{" "}
            with{" "}
            <span className="font-semibold text-chart-1 tabular-nums">
              {fmtInt(busiest.count)}
            </span>{" "}
            {busiest.count === 1 ? "commit" : "commits"}.
          </p>
        )}
      </div>

      <div className="mt-14 sm:mt-16">
        <h3 className="text-sm font-semibold sm:text-base">
          Rolling 48h commit count, last 14 days
        </h3>
        <RollingChart stats={stats} />
      </div>
    </section>
  );
}
