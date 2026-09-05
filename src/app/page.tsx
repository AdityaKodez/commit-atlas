import { PillNav } from "@/components/pill-nav";
import { ProfileCard, type ProfileSummary } from "@/components/profile-card";
import { RepoPanel } from "@/components/repo-panel";
import { SetupCard } from "@/components/setup-card";
import { utcMonthDayTime } from "@/lib/format";
import { getSiteData } from "@/lib/github";
import { CONFIG } from "@/lib/repos";
import {
  calendarWeeks,
  computeStats,
  countInWindow,
  hourWeekday,
  HOUR_MS,
  isMine,
  linesDaily,
  streaks,
} from "@/lib/stats";

/** Rebuild the page with fresh GitHub data every 30 minutes (ISR). */
export const revalidate = 1800;

export default async function Page() {
  const site = await getSiteData();

  if (!site.profile && site.repos.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <SetupCard />
      </main>
    );
  }

  const profile = site.profile;
  /**
   * A panel whose headline is "pushed 0 commits in the last 48 hours" is all
   * zeros and nothing to explore — hide those repos entirely.
   */
  const panels = site.repos
    .map((repo) => ({
      repo,
      stats: computeStats(
        repo.commits.map((c) => Date.parse(c.committedAt)),
        site.now,
      ),
    }))
    .filter(({ stats }) => stats.windowCount > 0);
  const summary = buildProfileSummary(site, profile, panels);

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
          Data from the GitHub REST API (default branch), refreshed every 30
          minutes. All times UTC.
          {!site.live && (
            <>
              {" "}
              Some repositories show a cached snapshot generated{" "}
              {utcMonthDayTime(site.snapshotAt)} UTC — run{" "}
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

function buildProfileSummary(
  site: Awaited<ReturnType<typeof getSiteData>>,
  profile: Awaited<ReturnType<typeof getSiteData>>["profile"],
  panels: Array<{
    repo: Awaited<ReturnType<typeof getSiteData>>["repos"][number];
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
