import "server-only";

import { unstable_cache } from "next/cache";
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

export type GitHubUser = {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
};

export type GitHubRepo = {
  name: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  owner: { login: string };
};

export type GitHubApiCommit = {
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
    cache: "no-store",
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

/** Profile configured by username, or the token owner when username is empty. */
async function getLiveProfile(): Promise<Profile | null> {
  try {
    if (CONFIG.username) {
      const path = `/users/${segment(CONFIG.username, "username")}`;
      return toProfile(await gh<GitHubUser>(ghUrl(path)));
    }
    if (process.env.GITHUB_TOKEN) {
      return toProfile(await gh<GitHubUser>(ghUrl("/user")));
    }
    return null;
  } catch {
    return null;
  }
}

/** The profile's own repositories, most recently pushed first. */
async function discoverRepos(profile: Profile): Promise<RepoConfig[]> {
  const path = CONFIG.username || !process.env.GITHUB_TOKEN
    ? `/users/${segment(profile.login, "login")}/repos`
    : "/user/repos";
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
      (r) =>
        !r.private &&
        !r.archived &&
        !r.disabled &&
        (CONFIG.includeForks || !r.fork),
    )
    .slice(0, CONFIG.maxRepos)
    .map((r) => ({ owner: r.owner.login, repo: r.name }));
}

async function fetchRepoMetadata(config: RepoConfig): Promise<GitHubRepo> {
  const owner = segment(config.owner, "owner");
  const repo = segment(config.repo, "repo");
  return gh<GitHubRepo>(ghUrl(`/repos/${owner}/${repo}`));
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
        ghUrl(`/repos/${owner}/${repo}/commits`, {
          per_page: "100",
          since,
          page: String(page),
        }),
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
    if (msg.includes("409")) {
      return [];
    }
    throw err;
  }
  return commits;
}

/** Fill line counts for a deterministic, pre-selected set of commits. */
async function hydrateCommitStats(
  config: RepoConfig,
  commits: Commit[],
): Promise<void> {
  const owner = segment(config.owner, "owner");
  const repo = segment(config.repo, "repo");
  const queue = [...commits];
  const workers = Array.from(
    { length: Math.min(12, queue.length) },
    async () => {
      while (queue.length > 0) {
        const commit = queue.shift();
        if (!commit) break;
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
    },
  );
  await Promise.all(workers);
}

type Snapshot = {
  fetchedAt: string;
  user: Profile | null;
  repoSlugs: string[];
  publicRepoSlugs: string[];
  repos: Record<string, Commit[] | undefined>;
};

/** Accept both old raw GitHub users and the normalized snapshot schema. */
function normalizeSnapshotProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  const login = typeof user.login === "string" ? user.login : "";
  const avatarUrl =
    typeof user.avatarUrl === "string"
      ? user.avatarUrl
      : typeof user.avatar_url === "string"
        ? user.avatar_url
        : "";
  const url =
    typeof user.url === "string" && !user.url.startsWith("https://api.github.com/")
      ? user.url
      : typeof user.html_url === "string"
        ? user.html_url
        : "";
  if (!login || !avatarUrl || !url) return null;
  return {
    login,
    name: typeof user.name === "string" ? user.name : null,
    avatarUrl,
    bio: typeof user.bio === "string" ? user.bio : null,
    url,
  };
}

function loadSnapshot(): Snapshot {
  const raw = snapshotJson as unknown as {
    fetchedAt?: unknown;
    user?: unknown;
    repoSlugs?: unknown;
    publicRepoSlugs?: unknown;
    repos?: unknown;
  } | null;
  return {
    fetchedAt: typeof raw?.fetchedAt === "string" ? raw.fetchedAt : "",
    user: normalizeSnapshotProfile(raw?.user),
    repoSlugs: Array.isArray(raw?.repoSlugs)
      ? raw.repoSlugs.filter((slug): slug is string => typeof slug === "string")
      : [],
    publicRepoSlugs: Array.isArray(raw?.publicRepoSlugs)
      ? raw.publicRepoSlugs.filter(
          (slug): slug is string => typeof slug === "string",
        )
      : [],
    repos:
      raw?.repos && typeof raw.repos === "object"
        ? (raw.repos as Record<string, Commit[] | undefined>)
        : {},
  };
}

function parseFullName(fullName: string): RepoConfig | null {
  const [owner, repo] = fullName.split("/");
  return owner && repo ? { owner, repo } : null;
}

function snapshotCommits(snapshot: Snapshot, config: RepoConfig): Commit[] {
  return snapshot.repos[repoFullName(config)] ?? [];
}

/**
 * Live data for the profile and every configured/discovered repo; falls back
 * per-repo to the committed snapshot (src/data/snapshot.json — regenerate with
 * `npm run snapshot`) when the GitHub API is unreachable or rate-limited, so
 * the page never renders empty.
 */
export async function getSiteData(requireLive = false): Promise<SiteData> {
  const now = Date.now();
  const since = new Date(
    now - Math.max(17, CONFIG.activityDays) * 24 * 3_600_000,
  ).toISOString();
  const linesWindowStart = now - 14 * 24 * 3_600_000;
  const snapshot = loadSnapshot();

  const profileExpected = Boolean(CONFIG.username || process.env.GITHUB_TOKEN);
  let profile = await getLiveProfile();
  let profileLive = profile !== null || !profileExpected;
  if (!profile && snapshot.user) {
    profile = snapshot.user;
    profileLive = false;
  }

  let configs: RepoConfig[] = CONFIG.repos;
  let configsLive = true;
  if (configs.length === 0 && CONFIG.autoDiscoverRepos) {
    let discovered: RepoConfig[] | null = null;
    if (profile) {
      try {
        discovered = await discoverRepos(profile);
      } catch {
        // Only a failed request uses snapshot repository names. A valid empty
        // response must stay empty instead of reviving old repositories.
      }
    }
    if (discovered !== null) {
      configs = discovered;
    } else {
      configsLive = false;
      configs = snapshot.publicRepoSlugs
        .map(parseFullName)
        .filter((config): config is RepoConfig => config !== null);
    }
  }

  let repoLoadIncomplete = false;
  const loadedRepos = await Promise.all(
    configs.map(async (config): Promise<RepoData | null> => {
      const fullName = repoFullName(config);
      let publicVerified = snapshot.publicRepoSlugs.includes(fullName);
      try {
        const metadata = await fetchRepoMetadata(config);
        if (metadata.private) return null;
        publicVerified = true;
      } catch {
        // A snapshot may only be served when its generator recorded that the
        // repository was public. Unknown visibility is omitted by default.
        if (!publicVerified) {
          repoLoadIncomplete = true;
          return null;
        }
      }

      try {
        const commits = await fetchRepoCommits(config, since);
        return {
          config,
          slug: repoSlug(config),
          name: repoLabel(config),
          commits,
          stale: false,
        };
      } catch {
        if (!publicVerified) return null;
        return {
          config,
          slug: repoSlug(config),
          name: repoLabel(config),
          commits: snapshotCommits(snapshot, config),
          stale: true,
        };
      }
    }),
  );
  const repos = loadedRepos.filter((repo): repo is RepoData => repo !== null);

  if (profile) {
    const detailLimit = process.env.GITHUB_TOKEN ? 250 : 25;
    const selected = repos
      .filter((repo) => !repo.stale)
      .flatMap((repo) =>
        repo.commits
          .filter(
            (commit) =>
              isMine(commit, profile) &&
              commit.additions === undefined &&
              Date.parse(commit.committedAt) >= linesWindowStart,
          )
          .map((commit) => ({ repo, commit })),
      )
      .sort((a, b) => {
        const byDate =
          Date.parse(b.commit.committedAt) - Date.parse(a.commit.committedAt);
        return byDate || a.commit.sha.localeCompare(b.commit.sha);
      })
      .slice(0, detailLimit);

    const byRepo = new Map<string, { config: RepoConfig; commits: Commit[] }>();
    for (const { repo, commit } of selected) {
      const key = repoFullName(repo.config);
      const group = byRepo.get(key) ?? { config: repo.config, commits: [] };
      group.commits.push(commit);
      byRepo.set(key, group);
    }
    await Promise.all(
      [...byRepo.values()].map(({ config, commits }) =>
        hydrateCommitStats(config, commits),
      ),
    );
  }

  const site: SiteData = {
    profile,
    repos,
    live:
      profileLive &&
      configsLive &&
      !repoLoadIncomplete &&
      repos.every((repo) => !repo.stale),
    snapshotAt: snapshot.fetchedAt,
    now,
  };
  if (requireLive && !site.live) {
    throw new Error("GitHub did not return a complete live aggregate");
  }
  return site;
}

const getCachedLiveSiteData = unstable_cache(
  () => getSiteData(true),
  ["github-site-live-v1"],
  { revalidate: 600, tags: ["github-site"] },
);

const getCachedFallbackSiteData = unstable_cache(
  () => getSiteData(),
  ["github-site-fallback-v1"],
  { revalidate: 60, tags: ["github-site-fallback"] },
);

/**
 * The long-lived cache only accepts complete live aggregates. Failed
 * revalidations therefore keep the previous good value; snapshot-backed data
 * is cached briefly and used only when no live aggregate is available.
 */
export async function getCachedSiteData(): Promise<SiteData> {
  try {
    return await getCachedLiveSiteData();
  } catch {
    return getCachedFallbackSiteData();
  }
}
