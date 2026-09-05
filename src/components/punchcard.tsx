"use client";

import { useState } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function level(count: number, max: number): string {
  if (count <= 0) return "bg-[#1b1b1f]";
  const frac = count / max;
  if (frac <= 0.25) return "bg-[#7c2d12]";
  if (frac <= 0.5) return "bg-[#c2410c]";
  if (frac <= 0.75) return "bg-[#ea580c]";
  return "bg-[#f97316]";
}

/**
 * "When do you code": rows = weekdays (Mon-first), cols = UTC hours, cell
 * intensity = commits. One shared viewport-fixed tooltip via event delegation.
 * Fully fluid — no min-width scroll on mobile; pointerdown covers touch.
 */
export function Punchcard({ grid }: { grid: number[][] }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(
    null,
  );
  const max = Math.max(1, ...grid.flat());

  const showTip = (e: React.PointerEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (!cell) {
      setTip(null);
      return;
    }
    setTip({
      text: cell.dataset.tip ?? "",
      // Clamp horizontally so translate(-50%) can't push the tooltip off-screen.
      x: Math.min(Math.max(e.clientX, 100), window.innerWidth - 100),
      y: e.clientY,
      below: e.clientY < 80,
    });
  };

  return (
    <div
      className="relative"
      onPointerOver={showTip}
      onPointerDown={showTip}
      onPointerLeave={() => setTip(null)}
    >
      {/* Header shares the exact same gapped column layout as the cells so
          hour labels stay centered over their columns at every width. */}
      <div
        className="grid text-[8px] leading-none text-muted-foreground sm:text-[9px]"
        style={{ gridTemplateColumns: "2.25rem 1fr" }}
        aria-hidden
      >
        <div />
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center">
              {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "2.25rem 1fr" }}>
        {DAY_LABELS.map((label, wd) => (
          <div key={label} className="contents">
            <div className="flex items-center leading-none text-muted-foreground">
              {label}
            </div>
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
              role="img"
              aria-label={`Commits by hour on ${label}`}
            >
              {grid[wd].map((count, h) => (
                <div
                  key={h}
                  data-tip={`${count} commit${count === 1 ? "" : "s"} · ${label} ${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00 UTC`}
                  className={`aspect-square rounded-[2px] transition-colors ${level(count, max)}`}
                />
              ))}
            </div>
          </div>
        ))}
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
