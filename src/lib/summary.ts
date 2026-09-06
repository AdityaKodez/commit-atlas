import { CONFIG } from "@/lib/repos";
import type { ProfileSummary } from "@/components/profile-card";
import type { SiteData } from "@/lib/github";
import {
  HOUR_MS,
  calendarWeeks,
  countInWindow,
  hourWeekday,
  isMine,
  linesDaily,
  streaks,
  type computeStats,
} from "@/lib/stats";

/**
 * Roll every repo's commits up into the profile-card numbers. Pure — the
 * server runs it at build time and the client re-runs it on live data.
 */
export function buildProfileSummary(
  site: SiteData,
  profile: SiteData["profile"],
  panels: Array<{
    repo: SiteData["repos"][number];
    stats: ReturnType<typeof computeStats>;
  }>,
): ProfileSummary | null {
  if (!profile) return null;
  const linesWindowStart = site.now - 14 * 24 * HOUR_MS;

  const mine = site.repos.flatMap((repo) =>
    repo.commits.filter((c) => isMine(c, profile)),
  );
  const mineTimes = mine.map((c) => Date.parse(c.committedAt));
  const mine14 = mine.filter((c) => Date.parse(c.committedAt) >= linesWindowStart);
  const withStats = mine14.filter((c) => c.additions !== undefined);
  const linesComplete = mine14.length > 0 && withStats.length === mine14.length;

  return {
    commits48: mineTimes.filter((t) => t >= site.now - 48 * HOUR_MS).length,
    commits14: mine14.length,
    previous48: countInWindow(
      mineTimes,
      site.now - 96 * HOUR_MS,
      site.now - 48 * HOUR_MS,
    ),
    lines:
      linesComplete && withStats.length > 0
        ? {
            additions: withStats.reduce((sum, c) => sum + (c.additions ?? 0), 0),
            deletions: withStats.reduce((sum, c) => sum + (c.deletions ?? 0), 0),
          }
        : null,
    weeks: calendarWeeks(mineTimes, site.now, CONFIG.activityDays),
    streaks: streaks(mineTimes, site.now),
    punchcard: hourWeekday(mineTimes),
    linesDays: linesDaily(
      withStats.map((c) => ({
        t: Date.parse(c.committedAt),
        additions: c.additions ?? 0,
        deletions: c.deletions ?? 0,
      })),
      site.now,
      14,
    ),
    linesComplete,
    perRepo: panels.map(({ repo }) => ({
      slug: repo.slug,
      name: repo.name,
      count: repo.commits.filter(
        (c) =>
          isMine(c, profile) && Date.parse(c.committedAt) >= linesWindowStart,
      ).length,
    })),
  };
}
