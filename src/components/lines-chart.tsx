"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { utcMonthDay } from "@/lib/format";
import type { LinesDay } from "@/lib/stats";

/**
 * Diverging bars for the last 14 days: lines added above the axis (orange),
 * lines removed below (gray). One tooltip per day column.
 */
export function LinesChart({ days }: { days: LinesDay[] }) {
  const max = Math.max(
    1,
    ...days.map((d) => Math.max(d.additions, d.deletions)),
  );

  return (
    <div className="flex h-36 w-full items-stretch gap-1.5">
      {days.map((day) => (
        <Tooltip key={day.start}>
          <TooltipTrigger asChild>
            <div className="flex flex-1 cursor-default flex-col justify-center">
              <div
                className="w-full rounded-t-sm bg-chart-1"
                style={{ height: `${(day.additions / max) * 50}%` }}
              />
              <div className="h-px w-full shrink-0 bg-border" />
              <div
                className="w-full rounded-b-sm bg-chart-2"
                style={{ height: `${(day.deletions / max) * 50}%` }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-chart-1">+{day.additions}</span>{" "}
            <span className="opacity-60">/ −{day.deletions}</span>
            <span className="opacity-60"> · {utcMonthDay(day.start)}</span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
