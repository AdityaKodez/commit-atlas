import type {
  Commit,
  GitHubApiCommit,
  GitHubRepo,
  GitHubUser,
  Profile,
  RepoData,
  SiteData,
} from "@/lib/github";
import { CONFIG, repoLabel, repoSlug, type RepoConfig } from "@/lib/repos";
import { isMine } from "@/lib/stats";

/**
 * Browser-side twin of getSiteData() in github.ts. The static export renders
 * the page once at build time, so fresh GitHub data is fetched here through
 * the site's here.now proxy route (/api/gh/* → api.github.com) which injects
 * GITHUB_TOKEN server-side — the token never ships to the browser.
 */

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function segment(value: string, label: string): string {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`Rejected unsafe GitHub API ${label}`);
  }
  return value;
}

/** Cooldown after a proxy 429 so auto-refresh stops hammering the route. */
let cooldownUntil = 0;

async function gh<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`/api/gh${path}${qs}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 429) {
    cooldownUntil = Date.now() + 30 * 60_000;
    throw new Error(`GitHub API 429 for ${path}`);
  }
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

function toProfile(u: GitHubUser): Profile {
  return {
    login: u.login,
    name: u.name,
    avatarUrl: u.avatar_url,
    bio: u.bio,
    url: u.html_url,
  };
}

async function fetchRepoCommits(
  config: RepoConfig,
  since: string,
): Promise<Commit[]> {
  const owner = segment(config.owner, "owner");
  const repo = segment(config.repo, "repo");
  const commits: Commit[] = [];
  try {
    for (let page = 1; page <= 20; page++) {
      const batch = await gh<GitHubApiCommit[]>(
        `/repos/${owner}/${repo}/commits`,
        { per_page: "100", since, page: String(page) },
      );
      if (!Array.isArray(batch)) break;
      for (const c of batch) {
        if (!c || !c.commit) continue;
        commits.push({
          sha: c.sha,
          message: (c.commit.message?.split("\n")[0] ?? "").slice(0, 200),
          author: c.commit.author?.name ?? "unknown",
          authorLogin: c.author?.login ?? null,
          committedAt:
            c.commit.committer?.date ??
            c.commit.author?.date ??
            new Date(0).toISOString(),
          url: c.html_url,
        });
      }
      if (batch.length < 100) break;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("409") || msg.includes("404")) {
      return [];
    }
    throw err;
  }
  return commits;
}

type Detail = { additions: number; deletions: number };

const DETAIL_PREFIX = "commit-atlas:detail:";

function readDetail(owner: string, repo: string, sha: string): Detail | null {
  try {
    const raw = window.localStorage.getItem(
      `${DETAIL_PREFIX}${owner}/${repo}:${sha}`,
    );
    return raw ? (JSON.parse(raw) as Detail) : null;
  } catch {
    return null;
  }
}

function writeDetail(
  owner: string,
  repo: string,
  sha: string,
  detail: Detail,
): void {
  try {
    window.localStorage.setItem(
      `${DETAIL_PREFIX}${owner}/${repo}:${sha}`,
      JSON.stringify(detail),
    );
  } catch {
    // Storage full/unavailable — the API fetch just repeats next time.
  }
}

/**
 * Fill in additions/deletions for the profile's own commits in the lines
 * window. Locally cached SHAs cost nothing; uncached ones spend the small
 * per-load budget so one page view can't blow through the proxy rate limit.
 */
async function hydrateCommitStats(
  config: RepoConfig,
  commits: Commit[],
  profile: Profile,
  linesWindowStart: number,
  budget: { left: number },
): Promise<void> {
  const owner = segment(config.owner, "owner");
  const repo = segment(config.repo, "repo");
  const mine = commits.filter(
    (c) =>
      isMine(c, profile) &&
      c.additions === undefined &&
      Date.parse(c.committedAt) >= linesWindowStart,
  );
  const uncached = mine.filter((c) => {
    const hit = readDetail(owner, repo, c.sha);
    if (hit) {
      c.additions = hit.additions;
      c.deletions = hit.deletions;
      return false;
    }
    return true;
  });
  const workers = Array.from(
    { length: Math.min(6, uncached.length) },
    async () => {
      while (uncached.length > 0 && budget.left > 0) {
        const commit = uncached.shift();
        if (!commit) break;
        budget.left -= 1;
        try {
          const detail = await gh<{ stats?: Detail }>(
            `/repos/${owner}/${repo}/commits/${segment(commit.sha, "sha")}`,
          );
          if (detail.stats) {
            commit.additions = detail.stats.additions;
            commit.deletions = detail.stats.deletions;
            writeDetail(owner, repo, commit.sha, detail.stats);
          }
        } catch {
          // Line counts are best-effort; the commit itself stays.
        }
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Live data for the profile and every auto-discovered repo, via the proxy.
 * Returns null (keeping whatever is on screen) when the proxy is cooling
 * down, rate-limited, or the GitHub API is unreachable.
 */
export async function fetchLiveSiteData(): Promise<SiteData | null> {
  if (Date.now() < cooldownUntil) return null;
  try {
    const now = Date.now();
    const since = new Date(
      now - Math.max(17, CONFIG.activityDays) * 24 * 3_600_000,
    ).toISOString();
    const linesWindowStart = now - 14 * 24 * 3_600_000;

    let profile: Profile | null = null;
    try {
      if (CONFIG.username) {
        profile = toProfile(
          await gh<GitHubUser>(`/users/${segment(CONFIG.username, "username")}`),
        );
      } else {
        profile = toProfile(await gh<GitHubUser>("/user"));
      }
    } catch {
      profile = null;
    }

    if (!profile) return null;

    let configs: RepoConfig[] = CONFIG.repos;
    if (configs.length === 0 && CONFIG.autoDiscoverRepos) {
      try {
        const path = CONFIG.username
          ? `/users/${segment(profile.login, "login")}/repos`
          : "/user/repos";
        const list = await gh<GitHubRepo[]>(path, {
          sort: "pushed",
          direction: "desc",
          per_page: "100",
          type: "owner",
        });
        configs = list
          .filter(
            (r) =>
              !r.archived && !r.disabled && (CONFIG.includeForks || !r.fork),
          )
          .slice(0, CONFIG.maxRepos)
          .map((r) => ({ owner: r.owner.login, repo: r.name }));
      } catch {
        configs = [];
      }
    }

    const budget = { left: 60 };
    const repos: RepoData[] = await Promise.all(
      configs.map(async (config): Promise<RepoData> => {
        let commits: Commit[] = [];
        let stale = false;
        try {
          commits = await fetchRepoCommits(config, since);
        } catch {
          stale = true;
        }
        if (profile && !stale && budget.left > 0) {
          await hydrateCommitStats(
            config,
            commits,
            profile,
            linesWindowStart,
            budget,
          );
        }
        return {
          config,
          slug: repoSlug(config),
          name: repoLabel(config),
          commits,
          stale,
        };
      }),
    );

    return {
      profile,
      repos,
      live: repos.every((r) => !r.stale),
      snapshotAt: "",
      now,
    };
  } catch {
    return null;
  }
}
