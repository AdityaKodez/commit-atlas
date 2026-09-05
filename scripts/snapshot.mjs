/**
 * Regenerates src/data/snapshot.json — the offline fallback the page uses when
 * the GitHub API is unreachable or rate-limited at build/revalidate time.
 *
 * Usage: npm run snapshot   (set GITHUB_TOKEN to include your profile and
 * private repos) — reads the same src/lib/repos.json as the app.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(
  readFileSync(path.join(root, "src/lib/repos.json"), "utf8"),
);
const snapshotPath = path.join(root, "src/data/snapshot.json");

// Plain Node doesn't load Next's env files — parse .env.local ourselves.
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
    // no .env.local — proceed with whatever is in the environment
  }
}
loadEnvLocal();

const token = process.env.GITHUB_TOKEN;
const HISTORY_DAYS = Math.max(17, config.activityDays ?? 183);

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function gh(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function fetchProfile() {
  try {
    if (token) return await gh("/user");
    if (config.username) return await gh(`/users/${config.username}`);
  } catch (err) {
    console.log(`profile fetch failed (${err.message})`);
  }
  return null;
}

// Mirrors discoverRepos() in src/lib/github.ts — keep the filters in sync.
async function discoverRepos(user) {
  if (!user) return [];
  const pathname = token
    ? "/user/repos"
    : `/users/${user.login}/repos`;
  const query = "?sort=pushed&direction=desc&per_page=100&type=owner";
  try {
    const list = await gh(`${pathname}${query}`);
    return list
      .filter(
        (r) =>
          !r.archived && !r.disabled && (config.includeForks || !r.fork),
      )
      .slice(0, config.maxRepos)
      .map((r) => ({ owner: r.owner.login, repo: r.name }));
  } catch (err) {
    console.log(`repo discovery failed (${err.message})`);
    return [];
  }
}

async function fetchCommits(owner, repo) {
  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await gh(
      `/repos/${owner}/${repo}/commits?per_page=100&since=${encodeURIComponent(since)}&page=${page}`,
    );
    for (const c of batch) {
      out.push({
        sha: c.sha,
        message: (c.commit.message.split("\n")[0] ?? "").slice(0, 200),
        author: c.commit.author?.name ?? "unknown",
        authorLogin: c.author?.login ?? null,
        committedAt: c.commit.committer?.date ?? c.commit.author?.date,
        url: c.html_url,
      });
    }
    if (batch.length < 100) break;
  }
  return out;
}

// Start from the existing snapshot so repos that fail to fetch keep their data.
let snapshot = { fetchedAt: "", user: null, repoSlugs: [], repos: {} };
try {
  snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
} catch {
  // first run — no snapshot yet
}

const user = await fetchProfile();
snapshot.user = user;

let repoConfigs = config.repos;
if (repoConfigs.length === 0 && config.autoDiscoverRepos) {
  repoConfigs = await discoverRepos(snapshot.user);
}

snapshot.repoSlugs = repoConfigs.map(({ owner, repo }) => `${owner}/${repo}`);
snapshot.fetchedAt = new Date().toISOString();

for (const { owner, repo } of repoConfigs) {
  const slug = `${owner}/${repo}`;
  process.stdout.write(`Fetching ${slug}... `);
  try {
    snapshot.repos[slug] = await fetchCommits(owner, repo);
    console.log(`${snapshot.repos[slug].length} commits`);
  } catch (err) {
    console.log(`failed (${err.message}) — keeping previous data`);
  }
}

mkdirSync(path.dirname(snapshotPath), { recursive: true });
writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Wrote ${path.relative(root, snapshotPath)}`);
