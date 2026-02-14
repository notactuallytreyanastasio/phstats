import type { Show } from './types'

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const paddedSeconds = String(seconds).padStart(2, '0')

  if (hours > 0) {
    const paddedMinutes = String(minutes).padStart(2, '0')
    return `${hours}:${paddedMinutes}:${paddedSeconds}`
  }

  return `${minutes}:${paddedSeconds}`
}

export function groupShowsByYear(shows: Show[]): Map<number, Show[]> {
  const map = new Map<number, Show[]>()
  for (const show of shows) {
    const year = parseInt(show.date.slice(0, 4), 10)
    const existing = map.get(year)
    if (existing) {
      existing.push(show)
    } else {
      map.set(year, [show])
    }
  }
  return map
}
