import type { Show, SongPerformance } from '../../core/types'

export async function fetchUserShowsScrape(_username: string): Promise<Show[]> {
  throw new Error('Not implemented')
}

export async function fetchSetlistScrape(_showDate: string): Promise<SongPerformance[]> {
  throw new Error('Not implemented')
}
