"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { PillNav } from "@/components/pill-nav";
import { ProfileCard } from "@/components/profile-card";
import { RepoPanel } from "@/components/repo-panel";
import { fetchLiveSiteData } from "@/lib/live";
import { formatMonthDayTime } from "@/lib/format";
import { computeStats } from "@/lib/stats";
import { buildProfileSummary } from "@/lib/summary";
import type { SiteData } from "@/lib/github";

type RefreshState = "build" | "loading" | "live" | "offline";

const REFRESH_MS = 10 * 60_000;

function useDashboardData(initial: SiteData) {
  const [site, setSite] = useState(initial);
  const [refreshState, setRefreshState] = useState<RefreshState>(
    initial.live ? "live" : "build",
  );
  const [now, setNow] = useState(() => Date.now());
  const refreshing = useRef(false);

  // Keep time synced with client clock
  useEffect(() => {
    const clockId = setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(clockId);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setRefreshState("loading");
    const fresh = await fetchLiveSiteData();
    refreshing.current = false;
    if (fresh) {
      setSite(fresh);
      setNow(Date.now());
      setRefreshState("live");
    } else {
      setRefreshState("offline");
    }
  }, []);

  useEffect(() => {
    // Only trigger immediate live fetch on mount if initial data was from snapshot
    if (!initial.live) {
      const timer = setTimeout(() => {
        void refresh();
      }, 0);
      const intervalId = setInterval(() => void refresh(), REFRESH_MS);
      return () => {
        clearTimeout(timer);
        clearInterval(intervalId);
      };
    }

    const intervalId = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [initial.live, refresh]);

  return { site, refreshState, now };
}

/**
 * The whole dashboard, hydrated from `initial`,
 * then re-fetched live so new pushes show up without a republish.
 */
export function SiteView({ initial }: { initial: SiteData }) {
  const { site, refreshState, now } = useDashboardData(initial);

  // If initial data is not live and we are in initial loading, show the loading skeleton
  if (!initial.live && refreshState === "loading" && !site.live) {
    return <DashboardSkeleton />;
  }

  const profile = site.profile;
  /**
   * A panel whose headline is "pushed 0 commits in the last 48 hours" is all
   * zeros and nothing to explore — hide those repos entirely.
   */
  const activeNow = now || site.now;
  const siteWithNow = { ...site, now: activeNow };
  const panels = site.repos.reduce<
    Array<{ repo: (typeof site.repos)[number]; stats: ReturnType<typeof computeStats> }>
  >((acc, repo) => {
    const stats = computeStats(
      repo.commits.map((c) => Date.parse(c.committedAt)),
      activeNow,
    );
    if (stats.windowCount > 0) {
      acc.push({ repo, stats });
    }
    return acc;
  }, []);
  const summary = buildProfileSummary(siteWithNow, profile, panels);

  return (
    <>
      <PillNav
        items={[
          ...(profile && summary
            ? [{ slug: "profile", label: "You", count: summary.commits48 }]
            : []),
          ...panels.map(({ repo, stats }) => ({
            slug: repo.slug,
            label: repo.name,
            count: stats.windowCount,
          })),
        ]}
      />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {profile && summary && <ProfileCard profile={profile} summary={summary} />}
        {profile && panels.length === 0 && (
          <p className="border-t border-border/60 py-10 text-sm text-muted-foreground">
            Nothing pushed in the last 48 hours across your repositories —
            panels appear here as soon as you push.
          </p>
        )}
        {panels.map(({ repo, stats }, i) => (
          <RepoPanel
            key={repo.slug}
            name={repo.name}
            config={repo.config}
            commits={repo.commits}
            stale={repo.stale}
            stats={stats}
            first={i === 0 && !profile}
          />
        ))}
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6">
        <p className="border-t border-border/60 pt-6 text-xs leading-5 text-muted-foreground">
          Data from the GitHub REST API (default branch).{" "}
          {refreshState === "live"
            ? "Live — refreshed in your browser, checks again every 10 minutes."
            : refreshState === "loading"
              ? "Refreshing from GitHub…"
              : refreshState === "offline"
                ? "Live refresh unavailable right now — showing the last data that loaded."
                : "Loading live data…"}
          {!site.live && (
            <>
              {" "}
              Some repositories show a cached snapshot generated{" "}
              {formatMonthDayTime(site.snapshotAt)} — run{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                npm run snapshot
              </code>{" "}
              to refresh it.
            </>
          )}
        </p>
      </footer>
    </>
  );
}
