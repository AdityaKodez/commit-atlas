"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { utcTime } from "@/lib/format";
import type { Commit } from "@/lib/github";

/**
 * One vertical line per commit in the current window. Lines are absolutely
 * positioned <a> elements (clickable, tooltip-able); the commit's x position
 * is its timestamp as a percentage of the 48h window.
 */
export function BarcodePlot({
  commits,
}: {
  commits: Array<Commit & { t: number; pct: number }>;
}) {
  if (commits.length === 0) {
    return (
      <p className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground sm:h-28">
        No commits in this window.
      </p>
    );
  }

  return (
    <div className="relative h-24 w-full sm:h-28" role="list">
      {commits.map((commit) => (
        <Tooltip key={commit.sha}>
          <TooltipTrigger asChild>
            <a
              role="listitem"
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={commit.message}
              className="absolute top-0 h-full w-[3px] -translate-x-1/2 bg-chart-1 transition-colors hover:bg-foreground focus-visible:bg-foreground focus-visible:outline-none"
              style={{ left: `${commit.pct}%` }}
            />
          </TooltipTrigger>
          <TooltipContent className="flex max-w-72 flex-col gap-1">
            <span className="line-clamp-3 font-medium">{commit.message}</span>
            <span className="opacity-60">
              {commit.author} · {utcTime(commit.committedAt)} UTC
            </span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
