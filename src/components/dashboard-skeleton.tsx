"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="w-full animate-fade-in" aria-label="Loading dashboard data">
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <section className="py-12 sm:py-14">
          <div className="flex flex-wrap items-center gap-5">
            <Skeleton className="size-16 rounded-full ring-2 ring-border sm:size-20" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-44 sm:w-56" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-end gap-x-12 gap-y-8">
            <div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-16 w-28 sm:h-20 sm:w-36" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="mt-3 h-4 w-40" />
            </div>
            <div>
              <Skeleton className="h-12 w-24 sm:h-14 sm:w-28" />
              <Skeleton className="mt-3 h-4 w-32" />
            </div>
            <div>
              <Skeleton className="h-12 w-36 sm:h-14 sm:w-44" />
              <Skeleton className="mt-3 h-4 w-48" />
            </div>
          </div>

          <div className="mt-12 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-4 w-64" />
            <div className="rounded-lg border border-border/40 p-4">
              <div className="grid grid-flow-col gap-1 overflow-hidden sm:gap-1.5">
                {Array.from({ length: 24 }).map((_, col) => (
                  <div key={col} className="grid grid-flow-row gap-1 sm:gap-1.5">
                    {Array.from({ length: 7 }).map((_, row) => (
                      <Skeleton
                        key={row}
                        className="size-3 rounded-[2px] opacity-40 sm:size-3.5"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <div>
              <Skeleton className="h-5 w-44" />
              <div className="mt-4 flex h-36 items-end gap-1.5 rounded-lg border border-border/40 p-3">
                {Array.from({ length: 14 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="flex-1 rounded-sm opacity-50"
                    style={{ height: `${20 + ((i * 17) % 65)}%` }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-2 h-4 w-72 max-w-full" />
              <div className="mt-4 h-36 rounded-lg border border-border/40 p-3">
                <div className="grid h-full grid-rows-7 gap-1">
                  {Array.from({ length: 7 }).map((_, r) => (
                    <div key={r} className="grid-cols-24 grid gap-1">
                      {Array.from({ length: 24 }).map((_, c) => (
                        <Skeleton
                          key={c}
                          className="h-full rounded-[2px] opacity-30"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 py-14 sm:py-16">
          <Skeleton className="h-7 w-48 sm:w-56" />
          <Skeleton className="mt-2 h-4 w-56" />

          <div className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-8 sm:mt-12 sm:gap-x-14">
            <div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-16 w-28 sm:h-20 sm:w-36" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="mt-3 h-4 w-36" />
            </div>
            <span className="pb-8 text-lg text-muted-foreground sm:pb-12 sm:text-xl">
              vs
            </span>
            <div>
              <Skeleton className="h-16 w-28 sm:h-20 sm:w-36" />
              <Skeleton className="mt-3 h-4 w-44" />
            </div>
            <div>
              <Skeleton className="h-12 w-20 sm:h-14 sm:w-24" />
              <Skeleton className="mt-3 h-4 w-28" />
            </div>
          </div>

          <div className="mt-14 space-y-4 sm:mt-16">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-4 w-72" />
          </div>

          <div className="mt-14 space-y-4 sm:mt-16">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6">
        <Skeleton className="h-4 w-72 max-w-full" />
      </footer>
    </div>
  );
}
