import configJson from "./repos.json";

export type RepoConfig = {
  owner: string;
  repo: string;
  /** Optional display name shown in headlines and the pill nav. */
  label?: string;
};

export type SiteConfig = {
  /**
   * GitHub username for the profile card. Leave empty ("") to resolve it from
   * GITHUB_TOKEN. Only public repositories are displayed.
   */
  username: string;
  /**
   * When `repos` is empty and a profile is known, discover the profile's own
   * repositories (most recently pushed first) instead of listing them by hand.
   */
  autoDiscoverRepos: boolean;
  /** Max repos to show when auto-discovering. */
  maxRepos: number;
  /** Include forked repos when auto-discovering. */
  includeForks: boolean;
  /**
   * How much commit history to fetch per repo, in days (drives the heatmap,
   * streaks and punchcard). Panel math only needs 17.
   */
  activityDays: number;
  /** Explicit repo list — overrides auto-discovery when non-empty. */
  repos: RepoConfig[];
};

/**
 * Edit this file (or just add GITHUB_TOKEN to .env.local and leave `repos`
 * empty to auto-discover your own repositories).
 */
export const CONFIG: SiteConfig = configJson;

export const REPOS: RepoConfig[] = CONFIG.repos;

export function repoSlug(config: RepoConfig): string {
  return `${config.owner}-${config.repo}`.replace(/[^a-zA-Z0-9-]/g, "-");
}

export function repoFullName(config: RepoConfig): string {
  return `${config.owner}/${config.repo}`;
}

export function repoLabel(config: RepoConfig): string {
  return config.label ?? repoFullName(config);
}
