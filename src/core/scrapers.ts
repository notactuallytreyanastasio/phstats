import type { Show, SongPerformance } from './types'

export function scrapeUserShows(_html: string): Show[] {
  throw new Error('Not implemented')
}

export function scrapeSetlist(_html: string, _showDate: string): SongPerformance[] {
  throw new Error('Not implemented')
}
