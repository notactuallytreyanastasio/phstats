/**
 * Core types for the Phish Stats Visualizer.
 * These are pure data types with no framework dependencies.
 */

/** A single Phish show */
export interface Show {
  id: number
  date: string
  venue: string
  city: string
  state: string
  country?: string
  setlistNotes: string | null
}

/** A track/song performance within a show (from phish.in) */
export interface Track {
  id: number
  title: string
  position: number
  duration: number // milliseconds
  setName: string
  showId: number
  showDate: string
}

/** A song in the catalog */
export interface Song {
  slug: string
  title: string
  tracksCount: number
  original: boolean
}

/** Aggregated stats for a year of shows */
export interface YearStats {
  year: number
  showCount: number
  uniqueVenues: number
  uniqueSongs: number
  totalDuration: number // milliseconds
  statesVisited: string[]
}

/** Gap data: how many shows between performances of a song */
export interface SongGap {
  songName: string
  currentGap: number
  lastPlayed: string
  averageGap: number
}

/** Attendance record for a user */
export interface UserAttendance {
  username: string
  shows: Show[]
}

/** A song performance record (enriched) */
export interface SongPerformance {
  songName: string
  showDate: string
  set: string
  position: number
  duration?: number
  isJamchart?: boolean
}
