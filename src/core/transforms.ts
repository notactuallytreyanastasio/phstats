import type { Show, Track, YearStats, SongGap, SongPerformance } from './types'

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

export function computeYearStats(year: number, shows: Show[], tracks: Track[]): YearStats {
  const uniqueVenues = new Set(shows.map(s => s.venue))
  const uniqueSongs = new Set(tracks.map(t => t.title))
  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0)
  const statesVisited = [...new Set(shows.map(s => s.state))]

  return {
    year,
    showCount: shows.length,
    uniqueVenues: uniqueVenues.size,
    uniqueSongs: uniqueSongs.size,
    totalDuration,
    statesVisited,
  }
}

export function findBustouts(performances: SongPerformance[], minGapDays: number): SongGap[] {
  const bySong = new Map<string, string[]>()
  for (const p of performances) {
    const dates = bySong.get(p.songName)
    if (dates) {
      dates.push(p.showDate)
    } else {
      bySong.set(p.songName, [p.showDate])
    }
  }

  const gaps: SongGap[] = []
  for (const [songName, dates] of bySong) {
    const sorted = dates.sort()
    if (sorted.length < 2) continue

    let maxGap = 0
    let totalGap = 0
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = Math.floor(
        (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff > maxGap) maxGap = daysDiff
      totalGap += daysDiff
    }

    const averageGap = Math.round(totalGap / (sorted.length - 1))

    if (maxGap >= minGapDays) {
      gaps.push({
        songName,
        currentGap: maxGap,
        lastPlayed: sorted[sorted.length - 1],
        averageGap,
      })
    }
  }

  return gaps.sort((a, b) => b.currentGap - a.currentGap)
}
