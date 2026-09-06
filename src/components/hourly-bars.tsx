"use client";

import { cn } from "cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTime } from "@/lib/format";
import { HOUR_MS, type RepoStats } from "@/lib/stats";

/** The shaded per-hour bars under the barcode plot — hover any bar. */
export function HourlyBars({ stats }: { stats: RepoStats }) {
  const max = Math.max(1, ...stats.hourly);
  return (
    <div className="mt-2 flex h-10 items-end gap-px">
      {stats.hourly.map((count, i) => {
        const start = stats.windowStart + i * HOUR_MS;
        const end = start + HOUR_MS;
        return (
          <Tooltip key={start}>
            <TooltipTrigger asChild>
              {/* min height keeps the whole strip hoverable, even empty hours */}
              <div
                className={cn(
                  "flex-1 transition-colors hover:bg-chart-1",
                  count > 0 ? "bg-chart-2/50" : "bg-transparent",
                )}
                style={{
                  height: `${(count / max) * 100}%`,
                  minHeight: 3,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {count === 0
                ? `No commits · ${formatTime(start)}`
                : `${count} commit${count === 1 ? "" : "s"} · ${formatTime(start)}–${formatTime(end)}`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
