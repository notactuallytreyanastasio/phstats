# Phish Stats Visualizer

A D3.js-powered visualization tool for Phish show attendance data. Enter a phish.net username and get creative, interactive visualizations of their concert history -- going beyond what phish.net or iHoz currently offer.

Test user: **someguyorwhatever**

## Stack

- **Vite 7** -- dev server and build tool
- **React 19** -- UI shell
- **TypeScript 5.9** -- strict typing throughout
- **Vitest 3** -- unit tests with jsdom environment
- **D3.js 7** -- data visualization
- **ESLint 9** -- linting with React hooks and refresh plugins

## Architecture: Functional Core / Imperative Shell

All code follows a strict separation between pure logic and side effects.

```
src/
  core/                         # Functional core: pure functions, zero side effects
    types.ts                    # Data types (Show, Track, Song, YearStats, etc.)
    transforms.ts               # Data transformations (grouping, stats, ranking)
    transforms.test.ts          # Tests for transforms
    parsers.ts                  # API response parsers (phish.net, phish.in)
    parsers.test.ts             # Tests for parsers
    index.ts                    # Barrel export for all core modules
    calculators/
      stats.ts                  # Statistical calculations (gaps, averages, grouping)
      stats.test.ts             # Tests for calculators
    formatters/
      date.ts                   # Date formatting (ISO, long, short, day-of-week)
      date.test.ts              # Tests for formatters
    transforms/
      index.ts                  # (empty placeholder)
    validators/
      index.ts                  # (empty placeholder)
  shell/                        # Imperative shell: side effects, React, fetch
    api/
      phishnet.ts               # phish.net API client (fetchUserShows, fetchSetlist)
      phishin.ts                # phish.in API client (fetchShowTracks)
      orchestrator.ts           # Orchestrates both APIs into complete UserStats
      orchestrator.test.ts      # Tests for orchestrator (3 passing)
    components/
      App.tsx                   # Root component (placeholder)
    hooks/
      usePhishData.ts           # React hook for data fetching (placeholder)
      useUserStats.ts           # React hook wrapping orchestrator with loading/error state
      useUserStats.test.ts      # Tests for useUserStats hook (4 passing)
    providers/
      index.ts                  # Context providers (empty placeholder)
  main.tsx                      # Vite entry point
  test-setup.ts                 # Vitest setup (jsdom)
  vite-env.d.ts                 # Vite type declarations
```

Path aliases configured in `vite.config.ts`:
- `@core` -> `src/core/`
- `@shell` -> `src/shell/`

## Data Sources

### phish.net API v5 (requires API key)

Base URL: `https://api.phish.net/v5`

| Endpoint | Returns | Used For |
|----------|---------|----------|
| `/attendance/username/{user}.json?apikey={key}` | Show attendance records | User's show list |
| `/setlists/showdate/{date}.json?apikey={key}` | Setlist entries per show | Song performances, jamcharts, set labels |
| `/songdata` | Song catalog with lyrics | Future: lyrics DB |

API key is free at [api.phish.net/keys](https://api.phish.net/keys). Stored in `.env` as `VITE_PHISHNET_API_KEY` (gitignored).

### phish.in API v2 (no auth required)

Base URL: `https://phish.in/api/v2`

| Endpoint | Returns | Used For |
|----------|---------|----------|
| `/shows/{date}` | Show data with track list | Track durations (ms), audio metadata |
| `/songs` | Song catalog (978 total) | Song metadata, `original: true` filter |

phish.in provides duration data that phish.net lacks. Returns 404 for shows not in their archive (handled gracefully with empty array fallback).

## What's Built

### Core Types (`src/core/types.ts`)

- **Show** -- id, date, venue, city, state, country, setlistNotes
- **Track** -- id, title, position, duration (ms), setName, showId, showDate
- **Song** -- slug, title, tracksCount, original
- **YearStats** -- year, showCount, uniqueVenues, uniqueSongs, totalDuration, statesVisited
- **SongGap** -- songName, currentGap, lastPlayed, averageGap
- **UserAttendance** -- username, shows
- **SongPerformance** -- songName, showDate, set, position, duration, isJamchart
- **UserStats** -- username, totalShows, totalSongs, uniqueSongs, totalDuration, yearStats, topSongs, statesVisited, venuesVisited, firstShow, lastShow

### Transform Functions (`src/core/transforms.ts`)

| Function | Description | Status |
|----------|-------------|--------|
| `formatDuration(ms)` | Formats milliseconds as `m:ss` or `h:mm:ss` | Done |
| `groupShowsByYear(shows)` | Groups `Show[]` into `Map<year, Show[]>` | Done |
| `computeYearStats(year, shows, tracks)` | Aggregates stats per year (venues, songs, duration, states) | Done |
| `findBustouts(performances, minGapDays)` | Finds songs with long gaps between performances, sorted by gap | Done |
| `computeSongFrequency(performances)` | Counts song plays, sorted by frequency then alphabetically | Done |
| `getSetBreakdown(tracks)` | Groups tracks by set name, sorted by position within each set | Done |
| `computeShowDurationRank(tracks)` | Ranks shows by total duration descending | Done |
| `computeUserStats(username, shows, performances, tracks)` | Comprehensive user stats combining all the above | Done |

### Calculator Functions (`src/core/calculators/stats.ts`)

| Function | Description | Status |
|----------|-------------|--------|
| `calculateShowGaps(dates)` | Days between consecutive show dates | Done |
| `averageShowGap(dates)` | Average gap in days | Done |
| `longestShowGap(dates)` | Longest drought between shows | Done |
| `shortestShowGap(dates)` | Shortest gap between shows | Done |
| `countUnique(items)` | Count unique values in an array | Done |
| `groupBy(items, keyFn)` | Generic group-by utility returning `Map<K, T[]>` | Done |
| `showsPerYear(dates)` | Count of shows per year | Done |

### Formatter Functions (`src/core/formatters/date.ts`)

| Function | Description | Status |
|----------|-------------|--------|
| `formatDateISO(date)` | Formats as `YYYY-MM-DD` | Done |
| `formatDateLong(date)` | Formats as `Month Day, Year` | Done |
| `formatDateShort(date)` | Formats as `M/D/YY` | Done |
| `parseDateString(str)` | Parses `YYYY-MM-DD` string to Date (validates leap years, etc.) | Done |
| `getDayOfWeek(date)` | Returns full day name | Done |

### Parsers (`src/core/parsers.ts`)

| Function | Description | Status |
|----------|-------------|--------|
| `parsePhishNetShows(raw)` | Converts phish.net attendance response to `Show[]` (deduplicates by showid) | Done |
| `parsePhishNetSetlist(raw)` | Converts phish.net setlist entries to `SongPerformance[]` (formats set labels: `e` -> `Encore`, `2` -> `Set 2`) | Done |
| `parsePhishInTracks(raw, showId)` | Converts phish.in track data to `Track[]` | Done |

### Shell API Clients (`src/shell/api/`)

| Module | Function | Description | Status |
|--------|----------|-------------|--------|
| `phishnet.ts` | `fetchUserShows(username, config)` | Fetches user attendance from phish.net, returns `Show[]` | Done |
| `phishnet.ts` | `fetchSetlist(showDate, config)` | Fetches setlist for a show date, returns `SongPerformance[]` | Done |
| `phishin.ts` | `fetchShowTracks(showDate)` | Fetches track data from phish.in, returns `Track[]` (empty on 404) | Done |
| `orchestrator.ts` | `fetchUserStats(username, config)` | Orchestrates both APIs into `UserStats` via Promise.all | Done |

### Test Coverage

All core functions have comprehensive test suites:

- `src/core/transforms.test.ts` -- 24 tests across 7 describe blocks
- `src/core/parsers.test.ts` -- 10 tests across 3 describe blocks
- `src/core/calculators/stats.test.ts` -- 14 tests across 6 describe blocks
- `src/core/formatters/date.test.ts` -- 11 tests across 5 describe blocks
- `src/shell/api/orchestrator.test.ts` -- 3 tests across 1 describe block
- `src/shell/hooks/useUserStats.test.ts` -- 4 tests across 1 describe block

## What's Planned

### React Hook (`src/shell/hooks/useUserStats.ts`)

| Function | Description | Status |
|----------|-------------|--------|
| `useUserStats(username, config)` | React hook wrapping orchestrator with loading/error/stats state | Done |

### Lyrics Database

Architecture for a local SQLite database of Phish lyrics with semantic search:

- **Source**: phish.net API v5 `songdata` endpoint (lyrics field)
- **Scope**: ~338 originals, ~253 with lyrics
- **Storage**: SQLite with FTS5 (Full-Text Search) using Porter stemmer
- **Driver**: `better-sqlite3` (Node.js)
- **Search modes**:
  - Keyword search via FTS5 (`MATCH` queries)
  - Thematic/semantic search via `claude -p --output-format json` for AI-powered lyric analysis
- **Privacy**: DB is local-only and gitignored (lyrics are copyrighted content)

### D3.js Visualization Components

Planned visualizations (none built yet):

- **Year Timeline** -- horizontal timeline showing shows per year with density/spacing
- **Song Frequency Chart** -- bar chart or treemap of most-seen songs
- **Venue Map** -- geographic visualization of venues visited (states/cities)
- **Bustout Tracker** -- visual representation of rare song gaps and bustouts
- **Show Duration Ranking** -- chart of longest/shortest shows attended
- **Set Breakdown View** -- visual setlist display with duration bars per song
- **Show Gap Analysis** -- visualization of drought periods between shows

### React Shell Components

- Dashboard layout component
- Username input and search
- Year selector/filter
- Individual visualization wrapper components
- Loading/error states

### React Hooks

- `usePhishData` -- currently a placeholder, will wire up to orchestrator
- `useYearFilter` -- filter data by selected year
- `useD3Chart` -- generic hook for D3 chart lifecycle management

### Context Providers

- API configuration context (API key management)
- User data context (shared state across components)

### Environment Setup

Create a `.env` file (gitignored) with:
```
VITE_PHISHNET_API_KEY=your_api_key_here
```

## Development Workflow

### TDD: Red-Green-Refactor

1. Write a failing test (commit: `test: add failing test for X`)
2. Write minimal code to pass (commit: `feat: implement X`)
3. Refactor if needed (commit: `refactor: clean up X`)

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### Dev Server

```bash
npm run dev           # Start Vite dev server
npm run build         # Type-check and build for production
npm run preview       # Preview production build
```
