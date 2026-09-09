# Editorial strip layout

Date: 2026-09-09
Status: approved

A layout pass on the Commit Atlas dashboard. The sticky top navbar is removed. Duplicate chrome, helper captions, and visualizations that restate the same number are cut so the page reads as one editorial strip: profile, then per-repo deep dives.

## Goal

The page should feel like a reference document of commit activity, not a product shell with a toolbar. After this pass a visitor sees identity, numbers, and charts — nothing that exists only to navigate or explain the UI.

## Decisions

- Delete the sticky `PillNav`. No replacement (no sidebar, floating dots, bottom bar, or jump pills).
- Keep the single-column long-read (`max-w-5xl`), dark monochrome theme, Work Sans, and existing charts.
- Brand lives on the profile identity line as muted text: `@handle · Commit Atlas`.
- Insight sentences stay (biggest day, peak hour, busiest hour). Hover-instruction captions go.
- No data-model, fetch, or chart-algorithm changes.

## Page composition

### Chrome

- No sticky header.
- Loading skeleton must not mimic a pill navbar.
- `scroll-mt-16` (offset for the old bar) is reduced; hash targets no longer sit under a header.
- Setup page is unchanged (it never had the navbar).

### Profile

Keep:

- Avatar, display name, `@handle` (GitHub link), bio.
- Quiet brand after the handle, not part of the link: ` · Commit Atlas`.
- Hero numbers: 48h commits + delta, 14-day commits, lines added/removed.
- Heatmap with heading “Commit activity, last 6 months”.
- Streaks as plain text (`current streak 7d · longest 7d`), not bordered pills.
- Biggest-day insight sentence.
- Two-column: lines-per-day chart and punchcard, with the peak-hour insight.

Cut:

- “One square per day — hover or tap…” and other hover-instruction captions.
- Per-repo jump pills under the charts.
- The “hover a column / hover a square” helper lines under lines and punchcard.

Keep the “line stats unavailable” empty state — that is data status, not instruction.

### Repo panel

Keep:

- Repo name as the heading.
- Subline: `{n} commits in the last 48 hours`.
- If the repo is stale: one muted word next to the title (`cached`), not a paragraph.
- Hero: current 48h vs median vs rate, with delta chip.
- “When they landed”: barcode + hourly bars + time axis.
- Busiest-hour insight as one sentence under the barcode.
- Rolling 48h chart with its heading.

Cut:

- The window / baseline / source paragraph under the old headline.
- Both dot matrices (they restate the hero numbers).
- Stats row (mean, p75, p90, max, % of windows).
- Hover-instruction captions under barcode and rolling chart.

### Footer

One quiet line, no snapshot timestamp, no `npm run snapshot`:

- Live: `Data from GitHub · live, checks every 10 minutes`
- Loading: `Data from GitHub · refreshing…`
- Offline: `Data from GitHub · live refresh unavailable — showing the last data that loaded`
- Initial: `Data from GitHub · loading live data…`

## Files

Edit:

- `src/components/site-view.tsx` — drop `PillNav`; shorten footer; drop unused snapshot copy.
- `src/components/profile-card.tsx` — brand, streaks, captions, pills.
- `src/components/repo-panel.tsx` — heading, drop dots/stats/captions, stale word, busiest-hour line.
- `src/components/dashboard-skeleton.tsx` — match the new composition.

Delete (unused after the pass):

- `src/components/pill-nav.tsx`
- `src/components/dot-matrix.tsx`
- `src/components/stats-row.tsx`

Leave `ProfileSummary.perRepo` in the data layer. It is unused in the UI after this pass; removing it is a separate cleanup.

## Out of scope

- New pages, routes, or navigation patterns.
- Chart geometry, GitHub fetch, live refresh interval, or snapshot pipeline.
- Theme / typography / color changes.
- Turning repo panels into a compact index or packing the profile into a dashboard header.

## Verification

- Desktop and a narrow viewport: no top bar, profile then repo panel, no pill chrome.
- Brand is visible next to the handle.
- Heatmap, lines, punchcard, barcode, hourly bars, and rolling chart still render and still have tooltips.
- Empty line-data state still shows.
- Footer has no `npm` command.
- Loading skeleton has no navbar.
- Setup card (no token) still renders without a navbar.
