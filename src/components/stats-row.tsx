import type { ReactNode } from "react";
import { cn } from "cn";

export type StatItem = { value: string; label: ReactNode };

export function StatsRow({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "lg:border-l lg:border-border lg:pl-6",
            i === 0 && "lg:border-l-0 lg:pl-0",
          )}
        >
          <div className="text-2xl font-bold tracking-tight tabular-nums">
            {item.value}
          </div>
          <div className="mt-1.5 max-w-44 text-xs leading-4 text-muted-foreground">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
