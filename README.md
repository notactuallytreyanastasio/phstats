# phstats

D3.js visualizations of Phish show data. Analyzes jamchart selections, song histories, set positions, and user attendance stats across all Phish 3.0 shows (2009-present).

**Live site:** https://notactuallytreyanastasio.github.io/phstats/

## Visualizations

### Jamchart Analysis (public)

All Phish 3.0 shows with year filtering:

- **Jam Vehicles** — Bubble scatter plot: X = total shows, Y = jamchart %, bubble size = count
- **Set Position Map** — Heatmap grid showing jamchart density by set and slot position
- **Rankings** — Horizontal bar chart of songs ranked by jamchart selections
- **Song Deep Dive** — Duration timeline for any song with jamchart markers, venue tooltips, and jam notes. Includes batting average (.JC/played), sort controls, and min-played filter

### User Comparisons (local only)

Multi-user attendance analysis (requires local SQLite database):

- **Song Treemap** — Territory map of shared vs unique songs across users
- **Taste Scatter** — Scatter plot comparing song counts between users
- **Show Timeline** — Timeline of all shows attended by each user
- **Year Compare** — Side-by-side year-over-year show counts
- **Stat Radar** — Radar chart comparing aggregate stats
- **Song Gaps** — Analysis of songs one user has seen that another hasn't

## Data

- **13,624 tracks** across **678 shows** from 2009-03-06 to 2026-01-31
- **751 unique songs** with **1,903 jamchart selections**
- Track data sourced from [phish.in](https://phish.in) API v2
- Attendance data scraped from [phish.net](https://phish.net) user profiles

## Stack

- Vite + React 19 + TypeScript
- D3.js for all visualizations
- SQLite (better-sqlite3) for local development
- Static JSON with client-side queries for GitHub Pages
- GitHub Actions for deployment

## Development

```bash
npm install
npm run dev
```

Requires a local SQLite database at `data/phstats.db` for the full experience (personal stats + user comparisons). The jamchart analysis works from the pre-built `data/tracks.json`.

### Scraping

Populate the database:

```bash
# Scrape user attendance from phish.net
npx tsx scripts/scrape-to-sqlite.ts <username>

# Fetch track data from phish.in for all 3.0 shows
npx tsx scripts/fetch-all-tracks-batch.ts <start_index> <end_index>
```

### Export static data

```bash
npx tsx scripts/export-static-data.ts
```

### Tests

```bash
npm test              # 92 tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage
```

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds the static site and deploys to GitHub Pages. The public site shows only the Jamchart Analysis section with all data pre-loaded as a single JSON file (~3.2MB, ~500KB gzipped).
