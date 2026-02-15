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

export async function fetchJamchartSongs(year: string): Promise<any[]> {
  if (isPublic) return staticQ.queryJamchartSongs(year)
  const param = year === 'all' ? '' : `?year=${year}`
  return fetchJson(`/api/jamchart-songs${param}`) ?? []
}

export async function fetchJamchartPositions(year: string): Promise<any[]> {
  if (isPublic) return staticQ.queryJamchartPositions(year)
  const param = year === 'all' ? '' : `?year=${year}`
  return fetchJson(`/api/jamchart-positions${param}`) ?? []
}

export async function fetchSongList(year: string): Promise<any[]> {
  if (isPublic) return staticQ.querySongList(year)
  const param = year === 'all' ? '' : `?year=${year}`
  return fetchJson(`/api/song-list${param}`) ?? []
}

export async function fetchShowHeat(year: string): Promise<any[]> {
  if (isPublic) return staticQ.queryShowHeat(year)
  const param = year === 'all' ? '' : `?year=${year}`
  return fetchJson(`/api/show-heat${param}`) ?? []
}

export async function fetchSongHistory(song: string, year: string): Promise<any> {
  if (isPublic) return staticQ.querySongHistory(song, year)
  const yearParam = year === 'all' ? '' : `&year=${year}`
  return fetchJson(`/api/song-history?song=${encodeURIComponent(song)}${yearParam}`)
}

export async function fetchVenueStats(year: string): Promise<any[]> {
  if (isPublic) return staticQ.queryVenueStats(year)
  const param = year === 'all' ? '' : `?year=${year}`
  return fetchJson(`/api/venue-stats${param}`) ?? []
}

export async function fetchJamEvolution(): Promise<any[]> {
  if (isPublic) return staticQ.queryJamEvolution()
  return fetchJson('/api/jam-evolution') ?? []
}

export async function fetchSongPairings(year: string, minShows: number = 3): Promise<any[]> {
  if (isPublic) return staticQ.querySongPairings(year, minShows)
  const params = new URLSearchParams()
  if (year !== 'all') params.set('year', year)
  if (minShows !== 3) params.set('min', String(minShows))
  const qs = params.toString()
  return fetchJson(`/api/song-pairings${qs ? '?' + qs : ''}`) ?? []
}
