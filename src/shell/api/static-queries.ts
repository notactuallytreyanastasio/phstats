/**
 * Client-side query functions that operate on in-memory track data.
 * Used by the static GH Pages build instead of server API calls.
 */

import type { TrackRow } from '../../core/track-queries'

export type { TrackRow }

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
