"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileCard } from "@/components/profile-card";
import { RepoPanel } from "@/components/repo-panel";
import { fetchLiveSiteData } from "@/lib/live";
import { computeStats } from "@/lib/stats";
import { buildProfileSummary } from "@/lib/summary";
import type { SiteData } from "@/lib/github";

type RefreshState = "cached" | "loading" | "live" | "offline";

const REFRESH_MS = 10 * 60_000;

function useDashboardData(initial: SiteData) {
  const [site, setSite] = useState(initial);
  const [refreshState, setRefreshState] = useState<RefreshState>(
    initial.live ? "live" : "cached",
  );
  const [now, setNow] = useState(() => Date.now());
  const refreshing = useRef(false);
  const siteRef = useRef(initial);

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
      const current = siteRef.current;
      const older = fresh.now < current.now;
      const downgradesLiveData = current.live && !fresh.live;
      if (older || downgradesLiveData) {
        setRefreshState(current.live ? "live" : "cached");
        return;
      }
      siteRef.current = fresh;
      setSite(fresh);
      setNow(Date.now());
      setRefreshState(fresh.live ? "live" : "cached");
    } else {
      setRefreshState("offline");
    }
  }, []);

  useEffect(() => {
    // Check immediately so a long-lived page does not wait another interval.
    // The existing dashboard remains visible while the backend responds.
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    const intervalId = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
    };
  }, [refresh]);

  return { site, refreshState, now };
}

/**
 * The whole dashboard, hydrated from `initial`,
 * then re-fetched live so new pushes show up without a republish.
 */
export function SiteView({ initial }: { initial: SiteData }) {
  const { site, refreshState, now } = useDashboardData(initial);

  const profile = site.profile;
  /** Repos with no commits in the trailing 48 hours stay off the page. */
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

  const status =
    refreshState === "live"
      ? "live, checks every 10 minutes"
      : refreshState === "loading"
        ? "refreshing…"
        : refreshState === "offline"
          ? "live refresh unavailable — showing the last data that loaded"
          : "cached fallback, retrying automatically";

  return (
    <>
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
          Data from GitHub · {status}
        </p>
      </footer>
    </>
  );
}
