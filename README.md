# Commit Atlas

A single-page, dark-theme dashboard of your GitHub activity: your profile and
aggregated commits (and lines added/removed) across your own repositories, plus
a reference-style per-repo panel — big-number hero vs. baseline median, dot
matrix, percentile stats row, a barcode plot of when each commit landed, and a
rolling 48-hour line chart with hover tooltips.

Built with Next.js (App Router), Tailwind v4, shadcn/ui, and Work Sans.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Production: `npm run build && npm start`.

## Connect your GitHub (required)

The site loads your profile and discovers your repositories automatically from
a GitHub token:

1. Create a personal access token at <https://github.com/settings/tokens>
   (classic) — no scopes needed for public repos only; add the `repo` scope to
   include private ones.
2. Create a `.env.local` file in the project root (gitignored, never committed):

   ```
   GITHUB_TOKEN=your_token_here
   ```

3. Restart the server. Your profile, your repositories (most recently pushed
   first), and your commit/line totals appear automatically.

The token is read only from the environment — it is never written into source
code. Without it the page shows a setup guide.

## Configuration (optional)

`src/lib/repos.json` controls everything:

```json
{
  "username": "",
  "autoDiscoverRepos": true,
  "maxRepos": 6,
  "includeForks": false,
  "repos": []
}
```

- `username` — leave `""` to resolve the profile from the token's own user;
  set a handle to show that profile via the public API instead.
- `repos` — explicit `owner/repo` list that **overrides** auto-discovery when
  non-empty. `label` per repo overrides the displayed name.
- Repositories with no commits in the data window are hidden automatically —
  no empty panels.

## Data & resilience

- Commits are read from each repo's **default branch**; the page revalidates
  every **30 minutes** (ISR — `export const revalidate` in
  `src/app/page.tsx`).
- Lines added/removed come from one detail call per commit of yours in the
  last 14 days (capped at 250 with a token, 25 without; tokenless runs may
  therefore show "unavailable").
- If the API is unreachable or rate-limited, the page falls back to
  `src/data/snapshot.json` so it never renders empty. Refresh it any time:

  ```bash
  npm run snapshot
  ```

- All timestamps are shown in **UTC**.

## The numbers

- **Profile card** — your avatar/bio, commits in the last 48h and 14 days
  (commits attributed to your GitHub account, or matching your git name for
  unlinked commits), lines `+added / −removed`, a hoverable commits-per-day
  bar chart, and per-repo pills.
- **Per-repo panels** — repo-wide activity in the reference layout:
  - Current window = commits in the trailing 48 hours; baseline = every hourly
    rolling 48h window ending in the prior 14 days (337 windows) → median,
    p75, p90, max, mean.
  - **When they landed** — one line per commit (hover: message; click: open on
    GitHub); shaded bars count commits per hour (hover any bar, even empty).
  - **Rolling chart** — each point counts the commits in the 48 hours before
    it; hover for a crosshair and exact count/period. The orange dot is now.

## Notes

- The project lives on a OneDrive path; if `npm install` or builds feel slow,
  consider excluding `node_modules` and `.next` from OneDrive sync.
- `scripts/snapshot.mjs` mirrors the fetch logic in `src/lib/github.ts` and
  reads the same `src/lib/repos.json` — no config to maintain twice.
