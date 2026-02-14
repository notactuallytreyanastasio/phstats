export interface Show {
  id: number
  date: string
  venue: string
  city: string
  state: string
  setlistNotes: string | null
}

export interface Track {
  id: number
  title: string
  position: number
  duration: number // milliseconds
  setName: string
  showId: number
  showDate: string
}

export interface YearStats {
  year: number
  showCount: number
  uniqueVenues: number
  uniqueSongs: number
  totalDuration: number // milliseconds
  statesVisited: string[]
}

export interface Song {
  slug: string
  title: string
  tracksCount: number
  original: boolean
}
