/**
 * Phish.net API client.
 * Imperative shell: all side effects (fetch) live here.
 */

import type { Show, SongPerformance } from '../../core/types'
import { parsePhishNetShows, parsePhishNetSetlist } from '../../core/parsers'

const PHISHNET_API_BASE = 'https://api.phish.net/v5'

export interface PhishNetConfig {
  apiKey: string
}

interface PhishNetResponse {
  error: number
  error_message: string
  data: unknown[]
}

/**
 * Fetch user attendance data from phish.net API.
 * Returns parsed Show[] for the given username.
 */
export async function fetchUserShows(
  username: string,
  config: PhishNetConfig,
): Promise<Show[]> {
  const url = `${PHISHNET_API_BASE}/attendance/username/${encodeURIComponent(username)}.json?apikey=${config.apiKey}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Phish.net API error: ${response.status} ${response.statusText}`)
  }
  const json = await response.json() as PhishNetResponse
  if (json.error !== 0) {
    throw new Error(`Phish.net API error ${json.error}: ${json.error_message}`)
  }
  return parsePhishNetShows(json.data as Parameters<typeof parsePhishNetShows>[0])
}

/**
 * Fetch setlist data for a specific show date.
 * Returns parsed SongPerformance[] for the show.
 */
export async function fetchSetlist(
  showDate: string,
  config: PhishNetConfig,
): Promise<SongPerformance[]> {
  const url = `${PHISHNET_API_BASE}/setlists/showdate/${showDate}.json?apikey=${config.apiKey}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Phish.net API error: ${response.status} ${response.statusText}`)
  }
  const json = await response.json() as PhishNetResponse
  if (json.error !== 0) {
    throw new Error(`Phish.net API error ${json.error}: ${json.error_message}`)
  }
  return parsePhishNetSetlist(json.data as Parameters<typeof parsePhishNetSetlist>[0])
}
