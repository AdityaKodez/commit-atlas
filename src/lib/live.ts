import type {
  Commit,
  Profile,
  RepoData,
  SiteData,
} from "@/lib/github";
import type { RepoConfig } from "@/lib/repos";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isProfile(value: unknown): value is Profile {
  if (!isRecord(value)) return false;
  return (
    typeof value.login === "string" &&
    (value.name === null || typeof value.name === "string") &&
    typeof value.avatarUrl === "string" &&
    (value.bio === null || typeof value.bio === "string") &&
    typeof value.url === "string"
  );
}

function isRepoConfig(value: unknown): value is RepoConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.owner === "string" &&
    typeof value.repo === "string" &&
    (value.label === undefined || typeof value.label === "string")
  );
}

function isCommit(value: unknown): value is Commit {
  if (!isRecord(value)) return false;
  return (
    typeof value.sha === "string" &&
    typeof value.message === "string" &&
    typeof value.author === "string" &&
    (value.authorLogin === null || typeof value.authorLogin === "string") &&
    typeof value.committedAt === "string" &&
    Number.isFinite(Date.parse(value.committedAt)) &&
    typeof value.url === "string" &&
    isOptionalNumber(value.additions) &&
    isOptionalNumber(value.deletions)
  );
}

function isRepoData(value: unknown): value is RepoData {
  if (!isRecord(value)) return false;
  return (
    isRepoConfig(value.config) &&
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.commits) &&
    value.commits.every(isCommit) &&
    typeof value.stale === "boolean"
  );
}

function isSiteData(value: unknown): value is SiteData {
  if (!isRecord(value)) return false;
  return (
    (value.profile === null || isProfile(value.profile)) &&
    Array.isArray(value.repos) &&
    value.repos.every(isRepoData) &&
    typeof value.live === "boolean" &&
    typeof value.snapshotAt === "string" &&
    (value.snapshotAt === "" || Number.isFinite(Date.parse(value.snapshotAt))) &&
    typeof value.now === "number" &&
    Number.isFinite(value.now)
  );
}

/**
 * Refresh the dashboard from the same cached backend aggregate used by the
 * initial server render. A failed or malformed response returns null so the UI
 * keeps the last coherent data instead of replacing it with partial results.
 */
export async function fetchLiveSiteData(): Promise<SiteData | null> {
  try {
    const response = await fetch("/api/site", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const site: unknown = await response.json();
    return isSiteData(site) ? site : null;
  } catch {
    return null;
  }
}
