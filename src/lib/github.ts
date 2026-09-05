import snapshotJson from "@/data/snapshot.json";
import {
  CONFIG,
  repoFullName,
  repoLabel,
  repoSlug,
  type RepoConfig,
} from "@/lib/repos";
import { isMine } from "@/lib/stats";

export type Commit = {
  sha: string;
  /** First line of the commit message. */
  message: string;
  /** Git author name (fallback when the commit isn't linked to a GitHub user). */
  author: string;
  /** GitHub account the commit is attributed to, when known. */
  authorLogin: string | null;
  /** ISO timestamp (committer date — when it landed on the branch). */
  committedAt: string;
  url: string;
  /** Lines changed — filled for your own commits when the API allows. */
  additions?: number;
  deletions?: number;
};

export type Profile = {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  url: string;
};

export type RepoData = {
  config: RepoConfig;
  slug: string;
  name: string;
  commits: Commit[];
  /** True when the live fetch failed and the committed snapshot was used. */
  stale: boolean;
};

export type SiteData = {
  profile: Profile | null;
  repos: RepoData[];
  /** False when at least one repo fell back to the snapshot. */
  live: boolean;
  /** Snapshot generation time (ISO), used in "data as of" notes. */
  snapshotAt: string;
  now: number;
};

const GITHUB_API_HOST = "api.github.com";

/**
 * Every value interpolated into an API path (usernames, owner/repo, SHAs) must
 * match this — it cannot escape its path segment or smuggle a URL.
 */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function segment(value: string, label: string): string {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`Rejected unsafe GitHub API ${label}`);
  }
  return value;
}

/**
 * Builds the request target as a parsed URL and pins protocol and host to the
 * GitHub API — paths like "//evil.example/x" or embedded userinfo are
 * rejected, so only https://api.github.com is ever fetched.
 */
function ghUrl(pathname: string, params?: Record<string, string>): URL {
  if (!pathname.startsWith("/")) {
    throw new Error("Rejected non-absolute GitHub API path");
  }
  const url = new URL(pathname, `https://${GITHUB_API_HOST}`);
  if (
    url.protocol !== "https:" ||
    url.host !== GITHUB_API_HOST ||
    url.username ||
    url.password
  ) {
    throw new Error("Rejected non-GitHub API request target");
  }
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  return url;
}

type GitHubUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
};

type GitHubRepo = {
  name: string;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  owner: { login: string };
};

type GitHubApiCommit = {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: {
    message: string;
    author: { name: string | null; date: string | null } | null;
    committer: { date: string | null } | null;
  };
};

function apiHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function gh<T>(url: URL): Promise<T> {
  const res = await fetch(url, {
    headers: apiHeaders(),
    next: { revalidate: 1800, tags: ["github"] },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${url.pathname}`);
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

/** Profile of the token's user, or of CONFIG.username via the public API. */
async function getLiveProfile(): Promise<Profile | null> {
  try {
    if (process.env.GITHUB_TOKEN) {
      return toProfile(await gh<GitHubUser>(ghUrl("/user")));
    }
    if (CONFIG.username) {
      const path = `/users/${segment(CONFIG.username, "username")}`;
      return toProfile(await gh<GitHubUser>(ghUrl(path)));
    }
    return null;
  } catch {
    return null;
  }
}

/** The profile's own repositories, most recently pushed first. */
async function discoverRepos(profile: Profile): Promise<RepoConfig[]> {
  const path = process.env.GITHUB_TOKEN
    ? "/user/repos"
    : `/users/${segment(profile.login, "login")}/repos`;
  const list = await gh<GitHubRepo[]>(
    ghUrl(path, {
      sort: "pushed",
      direction: "desc",
      per_page: "100",
      type: "owner",
    }),
  );
  return list
    .filter(
      (r) => !r.archived && !r.disabled && (CONFIG.includeForks || !r.fork),
    )
    .slice(0, CONFIG.maxRepos)
    .map((r) => ({ owner: r.owner.login, repo: r.name }));
}

async function fetchRepoCommits(
  config: RepoConfig,
  since: string,
): Promise<Commit[]> {
  const owner = segment(config.owner, "owner");
  const repo = segment(config.repo, "repo");
  const commits: Commit[] = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await gh<GitHubApiCommit[]>(
      ghUrl(`/repos/${owner}/${repo}/commits`, {
        per_page: "100",
        since,
        page: String(page),
      }),
    );
    for (const c of batch) {
      commits.push({
        sha: c.sha,
        message: (c.commit.message.split("\n")[0] ?? "").slice(0, 200),
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
  return commits;
}

/**
 * Fill in additions/deletions for the profile's own commits in the lines
 * window, in place. One detail call per commit, capped by `budget.left`.
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
  const workers = Array.from({ length: Math.min(12, mine.length) }, async () => {
    while (mine.length > 0 && budget.left > 0) {
      const commit = mine.shift();
      if (!commit) break;
      budget.left -= 1;
      try {
        const detail = await gh<{
          stats?: { additions: number; deletions: number };
        }>(
          ghUrl(
            `/repos/${owner}/${repo}/commits/${segment(commit.sha, "sha")}`,
          ),
        );
        if (detail.stats) {
          commit.additions = detail.stats.additions;
          commit.deletions = detail.stats.deletions;
        }
      } catch {
        // Line counts are best-effort; the commit itself stays.
      }
    }
  });
  await Promise.all(workers);
}

type Snapshot = {
  fetchedAt: string;
  user: Profile | null;
  repoSlugs: string[];
  repos: Record<string, Commit[] | undefined>;
};

function loadSnapshot(): Snapshot {
  const raw = snapshotJson as unknown as Partial<Snapshot> | null;
  return {
    fetchedAt: raw?.fetchedAt ?? "",
    user: raw?.user ?? null,
    repoSlugs: raw?.repoSlugs ?? [],
    repos: raw?.repos ?? {},
  };
}

function parseFullName(fullName: string): RepoConfig | null {
  const [owner, repo] = fullName.split("/");
  return owner && repo ? { owner, repo } : null;
}

function snapshotCommits(config: RepoConfig): Commit[] {
  return loadSnapshot().repos[repoFullName(config)] ?? [];
}

/**
 * Live data for the profile and every configured/discovered repo; falls back
 * per-repo to the committed snapshot (src/data/snapshot.json — regenerate with
 * `npm run snapshot`) when the GitHub API is unreachable or rate-limited, so
 * the page never renders empty.
 */
export async function getSiteData(): Promise<SiteData> {
  const now = Date.now();
  const since = new Date(
    now - Math.max(17, CONFIG.activityDays) * 24 * 3_600_000,
  ).toISOString();
  const linesWindowStart = now - 14 * 24 * 3_600_000;
  const snapshot = loadSnapshot();

  let profile = await getLiveProfile();
  if (!profile && snapshot.user) {
    profile = snapshot.user;
  }

  let configs: RepoConfig[] = CONFIG.repos;
  if (configs.length === 0 && CONFIG.autoDiscoverRepos) {
    if (profile) {
      try {
        configs = await discoverRepos(profile);
      } catch {
        configs = [];
      }
    }
    if (configs.length === 0 && snapshot.repoSlugs.length > 0) {
      configs = snapshot.repoSlugs
        .map(parseFullName)
        .filter((c): c is RepoConfig => c !== null);
    }
  }

  const budget = {
    left: process.env.GITHUB_TOKEN ? 250 : 25,
  };

  const repos: RepoData[] = await Promise.all(
    configs.map(async (config): Promise<RepoData> => {
      let commits: Commit[];
      let stale = false;
      try {
        commits = await fetchRepoCommits(config, since);
      } catch {
        commits = snapshotCommits(config);
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
    snapshotAt: snapshot.fetchedAt,
    now,
  };
}
