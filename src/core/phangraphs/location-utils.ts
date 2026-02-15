/**
 * Location parsing utilities.
 * Extracts state, country info from location strings.
 * Format: "City, ST" (US) or "City, Province, Country" (international).
 * Pure functions — no side effects.
 */

import type { TrackRow } from '../track-queries'

const US_STATE_RE = /^[A-Z]{2}$/

export function parseState(location: string): string | null {
  const parts = location.split(', ')
  if (parts.length < 2) return null
  const last = parts[parts.length - 1].trim()
  return US_STATE_RE.test(last) ? last : null
}

export function isUSLocation(location: string): boolean {
  return parseState(location) !== null
}

export function extractUniqueStates(tracks: TrackRow[]): string[] {
  const states = new Set<string>()
  for (const t of tracks) {
    const state = parseState(t.location)
    if (state) states.add(state)
  }
  return [...states].sort()
}

export function extractUniqueVenues(tracks: TrackRow[]): string[] {
  const venues = new Set<string>()
  for (const t of tracks) {
    venues.add(t.venue)
  }
  return [...venues].sort()
}
