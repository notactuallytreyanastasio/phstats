/**
 * Pure query functions over track data.
 * These operate on in-memory TrackRow arrays with no side effects.
 * Used by both the static client-side queries and server-side SQLite queries.
 */

export interface TrackRow {
  song_name: string
  show_date: string
  set_name: string
  position: number
  duration_ms: number
  likes: number
  is_jamchart: number
  jam_notes: string
  venue: string
  location: string
}

function filterByYear(tracks: TrackRow[], year: string): TrackRow[] {
  if (year === 'all') return tracks
  return tracks.filter(t => t.show_date.startsWith(year))
}

export interface VenueStats {
  venue: string
  location: string
  total_shows: number
  total_tracks: number
  jamchart_count: number
  jamchart_pct: number
  avg_duration_ms: number
}

export function computeVenueStats(tracks: TrackRow[], year: string): VenueStats[] {
  const filtered = filterByYear(tracks, year)

  const byVenue = new Map<string, {
    location: string; shows: Set<string>; total: number; jc: number; durMs: number
  }>()

  for (const t of filtered) {
    let entry = byVenue.get(t.venue)
    if (!entry) {
      entry = { location: t.location, shows: new Set(), total: 0, jc: 0, durMs: 0 }
      byVenue.set(t.venue, entry)
    }
    entry.shows.add(t.show_date)
    entry.total++
    entry.durMs += t.duration_ms
    if (t.is_jamchart) entry.jc++
  }

  return [...byVenue.entries()]
    .map(([venue, v]) => ({
      venue,
      location: v.location,
      total_shows: v.shows.size,
      total_tracks: v.total,
      jamchart_count: v.jc,
      jamchart_pct: v.total > 0 ? Math.round(1000 * v.jc / v.total) / 10 : 0,
      avg_duration_ms: v.total > 0 ? Math.round(v.durMs / v.total) : 0,
    }))
    .sort((a, b) => b.jamchart_count - a.jamchart_count)
}

export interface JamEvolutionYear {
  year: number
  total_shows: number
  total_tracks: number
  jamchart_count: number
  jc_per_show: number
  avg_duration_ms: number
  avg_jam_duration_ms: number
  new_vehicles: string[]
}

export function computeJamEvolution(tracks: TrackRow[]): JamEvolutionYear[] {
  // Track first jamchart year for each song to detect "new vehicles"
  const firstJcYear = new Map<string, number>()
  for (const t of tracks) {
    if (!t.is_jamchart) continue
    const yr = parseInt(t.show_date.substring(0, 4))
    const existing = firstJcYear.get(t.song_name)
    if (existing === undefined || yr < existing) {
      firstJcYear.set(t.song_name, yr)
    }
  }

  const byYear = new Map<number, {
    shows: Set<string>; total: number; jc: number; durMs: number; jamDurMs: number
  }>()

  for (const t of tracks) {
    const yr = parseInt(t.show_date.substring(0, 4))
    let entry = byYear.get(yr)
    if (!entry) {
      entry = { shows: new Set(), total: 0, jc: 0, durMs: 0, jamDurMs: 0 }
      byYear.set(yr, entry)
    }
    entry.shows.add(t.show_date)
    entry.total++
    entry.durMs += t.duration_ms
    if (t.is_jamchart) {
      entry.jc++
      entry.jamDurMs += t.duration_ms
    }
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([yr, v]) => {
      const newVehicles = [...firstJcYear.entries()]
        .filter(([, firstYr]) => firstYr === yr)
        .map(([name]) => name)
        .sort()
      return {
        year: yr,
        total_shows: v.shows.size,
        total_tracks: v.total,
        jamchart_count: v.jc,
        jc_per_show: v.shows.size > 0 ? Math.round(100 * v.jc / v.shows.size) / 100 : 0,
        avg_duration_ms: v.total > 0 ? Math.round(v.durMs / v.total) : 0,
        avg_jam_duration_ms: v.jc > 0 ? Math.round(v.jamDurMs / v.jc) : 0,
        new_vehicles: newVehicles,
      }
    })
}

export interface SongPairing {
  song_a: string
  song_b: string
  co_occurrences: number
}

export function computeSongPairings(tracks: TrackRow[], year: string, minShows: number = 3): SongPairing[] {
  const filtered = filterByYear(tracks, year)

  // Build per-show set of jammed songs
  const showJams = new Map<string, Set<string>>()
  for (const t of filtered) {
    if (!t.is_jamchart) continue
    let songs = showJams.get(t.show_date)
    if (!songs) {
      songs = new Set()
      showJams.set(t.show_date, songs)
    }
    songs.add(t.song_name)
  }

  // Count co-occurrences of jammed song pairs
  const pairCounts = new Map<string, number>()
  for (const songs of showJams.values()) {
    if (songs.size < 2) continue
    const sorted = [...songs].sort()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}|||${sorted[j]}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  return [...pairCounts.entries()]
    .filter(([, count]) => count >= minShows)
    .map(([key, count]) => {
      const [a, b] = key.split('|||')
      return { song_a: a, song_b: b, co_occurrences: count }
    })
    .sort((a, b) => b.co_occurrences - a.co_occurrences)
}
