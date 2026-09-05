/** Small ▲/▼ percentage comparing a current window against the previous one. */
export function DeltaChip({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0 && current === 0) return null;

  if (previous === 0) {
    return (
      <span className="whitespace-nowrap text-xs font-semibold text-chart-1">
        ▲ new
      </span>
    );
  }

  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return (
      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
        ±0%
      </span>
    );
  }

  const up = pct > 0;
  return (
    <span
      className={`whitespace-nowrap text-xs font-semibold ${up ? "text-chart-1" : "text-zinc-500"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}
