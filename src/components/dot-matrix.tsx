import { cn } from "cn";

export function DotMatrix({
  count,
  tone,
  columns,
  className,
}: {
  count: number;
  tone: "current" | "baseline";
  columns: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      aria-hidden
      className={cn("grid gap-[3px] sm:gap-1", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "aspect-square rounded-full",
            tone === "current" ? "bg-chart-1" : "bg-chart-2/80",
          )}
        />
      ))}
    </div>
  );
}
