/**
 * Classify shows into run types by date/venue pattern matching.
 * Priority: Halloween > NYE > Dick's > Festival > YEMSG > Regular.
 * Pure function — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { RunType } from './types'

const FESTIVAL_VENUES = [
  'Watkins Glen International',
  'Limestone',
  'Loring Commerce Centre',
  'Randall\'s Island',
  'Festival 8',
  'Magnaball',
  'Magna',
  'Curveball',
  'Mondegreen',
]

export function isHalloween(date: string): boolean {
  return date.endsWith('-10-31')
}

export function isNYE(date: string): boolean {
  const md = date.substring(5) // "MM-DD"
  return md >= '12-28' && md <= '12-31'
}

export function isDicks(venue: string): boolean {
  return venue.toLowerCase().includes("dick's")
}

export function isFestival(venue: string): boolean {
  const lower = venue.toLowerCase()
  return FESTIVAL_VENUES.some(f => lower.includes(f.toLowerCase()))
}

export function isYEMSG(venue: string): boolean {
  return venue.toLowerCase().includes('madison square garden')
}

export function classifyShow(date: string, venue: string): RunType {
  if (isHalloween(date)) return 'halloween'
  if (isNYE(date)) return 'nye'
  if (isDicks(venue)) return 'dicks'
  if (isFestival(venue)) return 'festival'
  if (isYEMSG(venue)) return 'yemsg'
  return 'regular'
}

export function classifyRuns(tracks: TrackRow[]): Map<string, RunType> {
  const runMap = new Map<string, RunType>()
  for (const t of tracks) {
    if (runMap.has(t.show_date)) continue
    runMap.set(t.show_date, classifyShow(t.show_date, t.venue))
  }
  return runMap
}
