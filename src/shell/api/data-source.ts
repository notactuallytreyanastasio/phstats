/**
 * Data source abstraction.
 * In dev mode: fetches from Vite dev server /api/ endpoints.
 * In static/public mode: loads from pre-built tracks.json and queries client-side.
 */

import * as staticQ from './static-queries'

const isPublic = import.meta.env.VITE_PUBLIC_MODE === 'true'

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url)
  if (!r.ok) return null
  return r.json()
}

export async function fetchJamchartYears(): Promise<number[]> {
  if (isPublic) return staticQ.queryJamchartYears()
  return fetchJson('/api/jamchart-years') ?? []
}

export async function fetchSongList(year: string): Promise<any[]> {
  if (isPublic) return staticQ.querySongList(year)
  const param = year === 'all' ? '' : `?year=${year}`
  return fetchJson(`/api/song-list${param}`) ?? []
}

export async function fetchSongHistory(song: string, year: string): Promise<any> {
  if (isPublic) return staticQ.querySongHistory(song, year)
  const yearParam = year === 'all' ? '' : `&year=${year}`
  return fetchJson(`/api/song-history?song=${encodeURIComponent(song)}${yearParam}`)
}

export async function fetchAllTracks(year: string): Promise<any[]> {
  if (isPublic) {
    const { loadTracks } = await import('./static-queries')
    const all = await loadTracks()
    if (year === 'all') return all
    return all.filter((t: any) => t.show_date.startsWith(year))
  }
  const param = year === 'all' ? '' : `?year=${year}`
  return fetchJson(`/api/all-tracks${param}`) ?? []
}
