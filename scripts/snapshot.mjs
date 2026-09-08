/**
 * Atomically regenerates src/data/snapshot.json, the backend's offline fallback.
 * If any required GitHub request fails, the existing snapshot is left intact.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(
  readFileSync(path.join(root, "src/lib/repos.json"), "utf8"),
);
const snapshotPath = path.join(root, "src/data/snapshot.json");

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || line.trim().startsWith("#")) continue;
      const value = match[2].replace(/^["']|["']$/g, "").trim();
      if (process.env[match[1]] === undefined && value) {
        process.env[match[1]] = value;
      }
    }
  } catch {
    // No .env.local; use the process environment.
  }
}
loadEnvLocal();

const token = process.env.GITHUB_TOKEN;
const historyDays = Math.max(17, config.activityDays ?? 183);
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function gh(pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!response.ok) {
    const error = new Error(`GitHub API ${response.status} for ${pathname}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function normalizeProfile(user) {
  return {
    login: user.login,
    name: user.name ?? null,
    avatarUrl: user.avatar_url,
    bio: user.bio ?? null,
    url: user.html_url,
  };
}

async function fetchProfile() {
  if (config.username) {
    return normalizeProfile(
      await gh(`/users/${encodeURIComponent(config.username)}`),
    );
  }
  if (token) return normalizeProfile(await gh("/user"));
  throw new Error("GITHUB_TOKEN or config.username is required");
}

async function discoverRepos(profile) {
  const pathname =
    config.username || !token
      ? `/users/${encodeURIComponent(profile.login)}/repos`
      : "/user/repos";
  const query = "?sort=pushed&direction=desc&per_page=100&type=owner";
  const list = await gh(`${pathname}${query}`);
  return list
    .filter(
      (repo) =>
        !repo.private &&
        !repo.archived &&
        !repo.disabled &&
        (config.includeForks || !repo.fork),
    )
    .slice(0, config.maxRepos)
    .map((repo) => ({ owner: repo.owner.login, repo: repo.name }));
}

async function fetchCommits(owner, repo) {
  const since = new Date(Date.now() - historyDays * 86_400_000).toISOString();
  const out = [];
  for (let page = 1; page <= 20; page++) {
    let batch;
    try {
      batch = await gh(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=100&since=${encodeURIComponent(since)}&page=${page}`,
      );
    } catch (error) {
      if (error.status === 409) return [];
      throw error;
    }
    for (const commit of batch) {
      out.push({
        sha: commit.sha,
        message: (commit.commit.message.split("\n")[0] ?? "").slice(0, 200),
        author: commit.commit.author?.name ?? "unknown",
        authorLogin: commit.author?.login ?? null,
        committedAt:
          commit.commit.committer?.date ??
          commit.commit.author?.date ??
          new Date(0).toISOString(),
        url: commit.html_url,
      });
    }
    if (batch.length < 100) break;
  }
  return out;
}

try {
  const user = await fetchProfile();
  let repoConfigs = config.repos;
  if (repoConfigs.length === 0 && config.autoDiscoverRepos) {
    repoConfigs = await discoverRepos(user);
  }

  const publicRepoConfigs = [];
  for (const repoConfig of repoConfigs) {
    const { owner, repo } = repoConfig;
    const metadata = await gh(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );
    if (metadata.private) {
      console.log(`Skipping private repository ${owner}/${repo}`);
      continue;
    }
    publicRepoConfigs.push(repoConfig);
  }

  const repos = {};
  for (const { owner, repo } of publicRepoConfigs) {
    const slug = `${owner}/${repo}`;
    process.stdout.write(`Fetching ${slug}... `);
    repos[slug] = await fetchCommits(owner, repo);
    console.log(`${repos[slug].length} commits`);
  }

  const publicRepoSlugs = publicRepoConfigs.map(
    ({ owner, repo }) => `${owner}/${repo}`,
  );
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    user,
    repoSlugs: publicRepoSlugs,
    publicRepoSlugs,
    repos,
  };
  mkdirSync(path.dirname(snapshotPath), { recursive: true });
  const temporaryPath = `${snapshotPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  renameSync(temporaryPath, snapshotPath);
  console.log(`Wrote ${path.relative(root, snapshotPath)}`);
} catch (error) {
  console.error(`Snapshot not updated: ${error.message}`);
  process.exitCode = 1;
}
