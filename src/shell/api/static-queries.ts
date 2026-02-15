/**
 * Client-side query functions that operate on in-memory track data.
 * Used by the static GH Pages build instead of server API calls.
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

let cachedTracks: TrackRow[] | null = null
let loadPromise: Promise<TrackRow[]> | null = null

export async function loadTracks(): Promise<TrackRow[]> {
  if (cachedTracks) return cachedTracks
  if (loadPromise) return loadPromise

  loadPromise = fetch(import.meta.env.BASE_URL + 'data/tracks.json')
    .then(r => r.json())
    .then((tracks: TrackRow[]) => {
      cachedTracks = tracks
      return tracks
    })

  return loadPromise
}

function filterByYear(tracks: TrackRow[], year: string): TrackRow[] {
  if (year === 'all') return tracks
  return tracks.filter(t => t.show_date.startsWith(year))
}

export async function queryJamchartYears(): Promise<number[]> {
  const tracks = await loadTracks()
  const years = new Set(tracks.map(t => parseInt(t.show_date.substring(0, 4))))
  return [...years].sort()
}

export async function queryJamchartSongs(year: string): Promise<any[]> {
  const tracks = filterByYear(await loadTracks(), year)

  const byName = new Map<string, { shows: Set<string>; jc: number }>()
  for (const t of tracks) {
    let entry = byName.get(t.song_name)
    if (!entry) {
      entry = { shows: new Set(), jc: 0 }
      byName.set(t.song_name, entry)
    }
    entry.shows.add(t.show_date)
    if (t.is_jamchart) entry.jc++
  }

  return [...byName.entries()]
    .filter(([, v]) => v.shows.size >= 2)
    .map(([name, v]) => ({
      song_name: name,
      total_shows: v.shows.size,
      jamchart_count: v.jc,
      jamchart_pct: Math.round(1000 * v.jc / v.shows.size) / 10,
    }))
    .sort((a, b) => b.jamchart_count - a.jamchart_count)
}

export async function queryJamchartPositions(year: string): Promise<any[]> {
  const tracks = filterByYear(await loadTracks(), year)

  const key = (t: TrackRow) => `${t.set_name}|${t.position}`
  const byPos = new Map<string, { total: number; jc: number; set_name: string; position: number }>()

  for (const t of tracks) {
    const k = key(t)
    let entry = byPos.get(k)
    if (!entry) {
      entry = { total: 0, jc: 0, set_name: t.set_name, position: t.position }
      byPos.set(k, entry)
    }
    entry.total++
    if (t.is_jamchart) entry.jc++
  }

  return [...byPos.values()]
    .map(e => ({
      set_label: e.set_name,
      position: e.position,
      total: e.total,
      jamcharts: e.jc,
    }))
    .sort((a, b) => a.set_label.localeCompare(b.set_label) || a.position - b.position)
}

export async function queryShowHeat(year: string): Promise<any[]> {
  const tracks = filterByYear(await loadTracks(), year)

  const byShow = new Map<string, { total: number; jc: number; durMs: number; jamDurMs: number; venue: string; location: string }>()
  for (const t of tracks) {
    let entry = byShow.get(t.show_date)
    if (!entry) {
      entry = { total: 0, jc: 0, durMs: 0, jamDurMs: 0, venue: t.venue, location: t.location }
      byShow.set(t.show_date, entry)
    }
    entry.total++
    entry.durMs += t.duration_ms
    if (t.is_jamchart) {
      entry.jc++
      entry.jamDurMs += t.duration_ms
    }
  }

  return [...byShow.entries()]
    .map(([date, v]) => ({
      show_date: date,
      total_tracks: v.total,
      jamchart_count: v.jc,
      total_duration_ms: v.durMs,
      jam_duration_ms: v.jamDurMs,
      venue: v.venue,
      location: v.location,
    }))
    .sort((a, b) => a.show_date.localeCompare(b.show_date))
}

export async function querySongList(year: string): Promise<any[]> {
  const tracks = filterByYear(await loadTracks(), year)

  const byName = new Map<string, { count: number; jc: number }>()
  for (const t of tracks) {
    let entry = byName.get(t.song_name)
    if (!entry) {
      entry = { count: 0, jc: 0 }
      byName.set(t.song_name, entry)
    }
    entry.count++
    if (t.is_jamchart) entry.jc++
  }

  return [...byName.entries()]
    .map(([name, v]) => ({
      song_name: name,
      times_played: v.count,
      jamchart_count: v.jc,
      jamchart_pct: Math.round(1000 * v.jc / v.count) / 10,
    }))
    .sort((a, b) => b.jamchart_count - a.jamchart_count || b.times_played - a.times_played)
}

export async function querySongHistory(songName: string, year: string): Promise<any> {
  const allTracks = await loadTracks()
  const tracks = filterByYear(allTracks, year)
    .filter(t => t.song_name === songName)
    .sort((a, b) => a.show_date.localeCompare(b.show_date))

  return {
    song_name: tracks[0]?.song_name ?? songName,
    tracks: tracks.map(t => ({
      ...t,
      duration_min: t.duration_ms > 0 ? +(t.duration_ms / 60000).toFixed(1) : null,
    })),
  }
}
