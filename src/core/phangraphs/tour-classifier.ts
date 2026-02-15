/**
 * Tour identification from track data.
 * Groups shows into tours by detecting gaps > threshold days.
 * Assigns season-based labels (Summer 2023, Fall 2023, NYE 2023).
 * Pure functions — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { TourInfo } from './types'

const DEFAULT_GAP_DAYS = 5

/**
 * Determine the season label for a tour based on start/end dates.
 * Jan-Mar → Winter, Apr-May → Spring, Jun-Aug → Summer,
 * Sep-Nov → Fall, Dec 28-31 → NYE, other Dec → Winter.
 */
export function seasonLabel(startDate: string, endDate: string): string {
  const startMonth = parseInt(startDate.substring(5, 7))
  const startDay = parseInt(startDate.substring(8, 10))
  const endMonth = parseInt(endDate.substring(5, 7))
  const endDay = parseInt(endDate.substring(8, 10))
  const year = parseInt(startDate.substring(0, 4))

  // NYE runs: if the tour includes Dec 28-31 (end in late Dec, or start in late Dec and end in Jan)
  if ((endMonth === 12 && endDay >= 28) || (startMonth === 12 && startDay >= 28)) {
    return `NYE ${year}`
  }

  // Use the start month to determine season
  const season = monthToSeason(startMonth)
  return `${season} ${year}`
}

function monthToSeason(month: number): string {
  if (month >= 1 && month <= 3) return 'Winter'
  if (month >= 4 && month <= 5) return 'Spring'
  if (month >= 6 && month <= 8) return 'Summer'
  if (month >= 9 && month <= 11) return 'Fall'
  return 'Winter' // December (non-NYE)
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function identifyTours(
  tracks: TrackRow[],
  gapThresholdDays: number = DEFAULT_GAP_DAYS
): TourInfo[] {
  // Extract unique show dates
  const dateSet = new Set<string>()
  for (const t of tracks) dateSet.add(t.show_date)

  const dates = [...dateSet].sort()
  if (dates.length === 0) return []

  // Group into tours by gap threshold
  const tourGroups: string[][] = []
  let currentGroup = [dates[0]]

  for (let i = 1; i < dates.length; i++) {
    const gap = daysBetween(dates[i - 1], dates[i])
    if (gap > gapThresholdDays) {
      tourGroups.push(currentGroup)
      currentGroup = [dates[i]]
    } else {
      currentGroup.push(dates[i])
    }
  }
  tourGroups.push(currentGroup)

  // Build TourInfo for each group, disambiguating labels
  const labelCounts = new Map<string, number>()
  const tours: TourInfo[] = []

  for (const shows of tourGroups) {
    const startDate = shows[0]
    const endDate = shows[shows.length - 1]
    const label = seasonLabel(startDate, endDate)

    const count = (labelCounts.get(label) ?? 0) + 1
    labelCounts.set(label, count)

    const tourLabel = count > 1 ? `${label} (${count})` : label
    const tourId = tourLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')

    tours.push({
      tourId,
      tourLabel,
      startDate,
      endDate,
      showCount: shows.length,
      shows,
    })
  }

  // Go back and fix labels if a season appeared only once (no disambiguation needed)
  // But if it appeared >1 time, the first one also needs "(1)"
  for (const [label, count] of labelCounts) {
    if (count > 1) {
      // Find the first tour with this base label and rename it
      const first = tours.find(t => t.tourLabel === label)
      if (first) {
        first.tourLabel = `${label} (1)`
        first.tourId = first.tourLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
      }
    }
  }

  return tours
}

export function buildTourDateMap(tours: TourInfo[]): Map<string, TourInfo> {
  const map = new Map<string, TourInfo>()
  for (const tour of tours) {
    for (const date of tour.shows) {
      map.set(date, tour)
    }
  }
  return map
}
