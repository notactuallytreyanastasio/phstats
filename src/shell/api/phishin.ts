/**
 * Phish.in API v2 client.
 * Imperative shell: all side effects (fetch) live here.
 * No API key needed for phish.in.
 */

import type { Track } from '../../core/types'
import { parsePhishInTracks } from '../../core/parsers'

const PHISHIN_API_BASE = 'https://phish.in/api/v2'

interface PhishInShowResponse {
  data: {
    id: number
    date: string
    duration: number
    venue_name: string
    tracks: unknown[]
  }
}

/**
 * Fetch track data for a specific show date from phish.in.
 * Returns parsed Track[] with durations in milliseconds.
 */
export async function fetchShowTracks(showDate: string): Promise<Track[]> {
  const url = `${PHISHIN_API_BASE}/shows/${showDate}`
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })
  if (!response.ok) {
    if (response.status === 404) return [] // show not on phish.in
    throw new Error(`Phish.in API error: ${response.status} ${response.statusText}`)
  }
  const json = await response.json() as PhishInShowResponse
  return parsePhishInTracks(
    json.data.tracks as Parameters<typeof parsePhishInTracks>[0],
    json.data.id,
  )
}
