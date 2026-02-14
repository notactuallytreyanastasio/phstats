import type { Show, Track, SongPerformance } from './types'

interface RawPhishNetShow {
  showid: number
  showdate: string
  venue: string
  city: string
  state: string
  country: string
}

interface RawPhishNetSetlistEntry {
  showdate: string
  song: string
  set: string
  position: string
  isjamchart: string
  tracktime: string
  gap: string
}

interface RawPhishInTrack {
  id: number
  title: string
  position: number
  duration: number
  set_name: string
  show_date: string
}

function formatSetLabel(rawSet: string): string {
  if (rawSet === 'e') return 'Encore'
  if (rawSet.startsWith('e')) return `Encore ${rawSet.slice(1)}`
  return `Set ${rawSet}`
}

export function parsePhishNetShows(raw: RawPhishNetShow[]): Show[] {
  const seen = new Set<number>()
  const shows: Show[] = []

  for (const entry of raw) {
    if (seen.has(entry.showid)) continue
    seen.add(entry.showid)
    shows.push({
      id: entry.showid,
      date: entry.showdate,
      venue: entry.venue,
      city: entry.city,
      state: entry.state,
      country: entry.country,
      setlistNotes: null,
    })
  }

  return shows
}

export function parsePhishNetSetlist(raw: RawPhishNetSetlistEntry[]): SongPerformance[] {
  return raw.map(entry => ({
    songName: entry.song,
    showDate: entry.showdate,
    set: formatSetLabel(entry.set),
    position: parseInt(entry.position, 10),
    isJamchart: entry.isjamchart === '1',
  }))
}

export function parsePhishInTracks(raw: RawPhishInTrack[], showId: number): Track[] {
  return raw.map(entry => ({
    id: entry.id,
    title: entry.title,
    position: entry.position,
    duration: entry.duration,
    setName: entry.set_name,
    showId,
    showDate: entry.show_date,
  }))
}
