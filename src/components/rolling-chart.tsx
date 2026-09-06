"use client";

import { useId, useState } from "react";
import { fmtInt, formatMonthDay, formatMonthDayTime } from "@/lib/format";
import type { RepoStats } from "@/lib/stats";

const W = 1000;
const H = 200;

/**
 * Gray line: trailing-48h commit count sampled hourly over the last 14 days.
 * White stem + point: the current window. Values above the y-max clamp to the
 * top edge. Hovering shows the exact count and period in plain language.
 */
export function RollingChart({ stats }: { stats: RepoStats }) {
  const [hover, setHover] = useState<number | null>(null);
  const { series, yMax, windowCount } = stats;
  const n = series.length;
  const safeYMax = Math.max(1, yMax);

  const yPct = (count: number) => (1 - Math.min(count / safeYMax, 1)) * 100;
  const y = (count: number) => (yPct(count) / 100) * H;
  const x = (i: number) => (i / (n - 1)) * W;

  const path = series
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.count).toFixed(2)}`,
    )
    .join(" ");

  const nowYPct = yPct(windowCount);
  const gradId = useId().replace(/:/g, "");
  const hoverPoint = hover !== null ? series[hover] : null;
  const hoverXPct =
    hover !== null ? (hover / (n - 1)) * 100 : 0;

  const ticks = Array.from({ length: 7 }, (_, k) => {
    const idx = Math.round((k * (n - 1)) / 6);
    return series[idx].t;
  });

  return (
    <div className="mt-6 pt-7 pb-6 pl-9 sm:pl-10">
      <div className="relative h-40 w-full sm:h-48">
        {[1, 0.75, 0.5, 0.25, 0].map((f) => (
          <span
            key={f}
            className="absolute right-full mr-2 w-7 -translate-y-1/2 text-right text-[10px] leading-none tabular-nums text-muted-foreground"
            style={{ top: `${((1 - f) * 100).toFixed(2)}%` }}
          >
            {fmtInt(yMax * f)}
          </span>
        ))}

        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={`area-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={f * H}
              y2={f * H}
              stroke="var(--border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={`${path} L${W},${H} L0,${H} Z`}
            fill={`url(#area-${gradId})`}
            stroke="none"
          />
          <path
            d={path}
            fill="none"
            stroke="var(--chart-2)"
            strokeWidth={1.6}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {hoverPoint && (
          <>
            <div
              className="absolute top-0 h-full w-px bg-foreground/30"
              style={{ left: `${hoverXPct.toFixed(2)}%` }}
              aria-hidden
            />
            <div
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{
                left: `${hoverXPct.toFixed(2)}%`,
                top: `${yPct(hoverPoint.count).toFixed(2)}%`,
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground"
              style={{
                left: `${Math.min(88, Math.max(12, hoverXPct)).toFixed(2)}%`,
                transform: "translateX(-50%) translateY(calc(-100% - 8px))",
              }}
            >
              <span className="font-semibold tabular-nums">
                {fmtInt(hoverPoint.count)}
              </span>{" "}
              {hoverPoint.count === 1 ? "commit" : "commits"} in the 48 hours
              ending {formatMonthDayTime(hoverPoint.t)}
            </div>
          </>
        )}

        <div
          className="absolute inset-x-0 top-0 h-full"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const frac = (e.clientX - rect.left) / rect.width;
            const idx = Math.round(frac * (n - 1));
            setHover(Math.min(n - 1, Math.max(0, idx)));
          }}
          onPointerLeave={() => setHover(null)}
        />

        <div
          className="absolute right-0 top-0 w-px bg-chart-1"
          style={{ height: `${nowYPct.toFixed(2)}%` }}
          aria-hidden
        />
        <div
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1"
          style={{ right: 0.5, top: `${nowYPct.toFixed(2)}%` }}
          aria-hidden
        />
        <span className="absolute right-0 -top-6 text-xs font-semibold text-chart-1">
          now: {fmtInt(windowCount)}
        </span>

        <div className="absolute top-full left-0 right-0 mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          {ticks.map((t) => (
            <span key={t}>{formatMonthDay(t)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
