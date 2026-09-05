"use client";

import { useState } from "react";
import { utcMonthDay } from "@/lib/format";
import type { CalendarCell } from "@/lib/stats";

const LEVEL_CLASSES = [
  "bg-[#1b1b1f]",
  "bg-[#7c2d12]",
  "bg-[#c2410c]",
  "bg-[#ea580c]",
  "bg-[#f97316]",
];

function level(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  const frac = count / max;
  if (frac <= 0.25) return 1;
  if (frac <= 0.5) return 2;
  if (frac <= 0.75) return 3;
  return 4;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * GitHub-style contribution grid: columns are weeks (Sun–Sat rows), intensity
 * = commits that day. One shared viewport-fixed tooltip via event delegation —
 * no per-cell tooltip components.
 */
export function Heatmap({ weeks }: { weeks: CalendarCell[][] }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(
    null,
  );

  const max = Math.max(
    1,
    ...weeks.flatMap((week) => week.map((cell) => cell.count)),
  );

  // Month labels: first week column whose Sunday starts a new month.
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const month = new Date(week[0].date).getUTCMonth();
    if (month !== lastMonth) {
      monthLabels.push({ col, label: MONTHS[month] });
      lastMonth = month;
    }
  });

  // Shared by pointer hover and touch taps.
  const showTip = (x: number, y: number, text: string) => {
    setTip({
      text,
      // Clamp horizontally so translate(-50%) can't push the tooltip off-screen.
      x: Math.min(Math.max(x, 100), window.innerWidth - 100),
      y,
      below: y < 80,
    });
  };

  return (
    <div
      className="relative"
      onPointerOver={(e) => {
        const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
        if (!cell) {
          setTip(null);
          return;
        }
        showTip(e.clientX, e.clientY, cell.dataset.tip ?? "");
      }}
      onPointerDown={(e) => {
        const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
        if (cell) showTip(e.clientX, e.clientY, cell.dataset.tip ?? "");
      }}
      onPointerLeave={() => setTip(null)}
    >
      <div
        className="grid gap-[2px] text-[9px] leading-none text-muted-foreground sm:gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {weeks.map((_, col) => {
          const label = monthLabels.find((m) => m.col === col);
          return (
            <div key={col} className="h-3">
              {label && <span className="whitespace-nowrap">{label.label}</span>}
            </div>
          );
        })}
      </div>

      <div
        className="grid grid-flow-col gap-[2px] sm:gap-[3px]"
        style={{
          gridTemplateRows: "repeat(7, minmax(0, 1fr))",
          gridAutoColumns: "minmax(0, 1fr)",
        }}
        role="img"
        aria-label="Contribution heatmap of your commits per day"
      >
        {weeks.flatMap((week) =>
          week.map((cell) => (
            <div
              key={cell.date}
              data-tip={
                cell.future
                  ? undefined
                  : `${cell.count} commit${cell.count === 1 ? "" : "s"} · ${utcMonthDay(cell.date)}`
              }
              className={`aspect-square rounded-[2px] ${cell.future ? "invisible" : LEVEL_CLASSES[level(cell.count, max)]}`}
            />
          )),
        )}
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground"
          style={{
            left: tip.x,
            top: tip.y,
            transform: tip.below
              ? "translate(-50%, 14px)"
              : "translate(-50%, calc(-100% - 8px))",
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
