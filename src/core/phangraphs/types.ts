/**
 * PhanGraphs type contracts.
 * All interfaces for the sabermetrics computation pipeline.
 * Pure data types — no logic, no side effects, no imports from shell.
 */

import type { TrackRow } from '../track-queries'
export type { TrackRow }

/** Ordered index of all show dates for gap computation */
export interface ShowIndex {
  dates: string[]
  dateToIndex: Map<string, number>
  totalShows: number
}

/** Run classification for a show */
export type RunType = 'nye' | 'dicks' | 'halloween' | 'yemsg' | 'festival' | 'regular'

/** Run leverage multipliers (from PRD) */
export const RUN_LEVERAGE: Record<RunType, number> = {
  halloween: 1.5,
  festival: 1.25,
  nye: 1.0,
  yemsg: 1.0,
  dicks: 0.75,
  regular: 0.0,
}

/** Bustout tier based on show gap */
export type BustoutTier = 'none' | 'bustout' | 'significant' | 'major' | 'historic'

/** Bustout PVS bonus values */
export const BUSTOUT_BONUS: Record<BustoutTier, number> = {
  none: 0,
  bustout: 0.5,
  significant: 1.0,
  major: 1.5,
  historic: 2.5,
}

/** Tour identification */
export interface TourInfo {
  tourId: string
  tourLabel: string
  startDate: string
  endDate: string
  showCount: number
  shows: string[]
}

/** Position within a multi-night venue run */
export interface VenueRunInfo {
  venue: string
  runLength: number
  positionInRun: number
  isOpener: boolean
  isCloser: boolean
}

/** Set position classification */
export type SetPosition = 'opener' | 'closer' | 'middle'

/** Per-song counting stats */
export interface SongCountingStats {
  songName: string
  showsAppearedIn: number
  timesPlayed: number
  jamchartCount: number
  times20Min: number
  times25Min: number
  totalMinutesPlayed: number
  bustoutCount: number
  megaBustoutCount: number
  maxShowsBetweenPlays: number
  avgShowsBetweenPlays: number
}

/** Per-song rate stats */
export interface SongRateStats {
  songName: string
  jamRate: number
  rate20Plus: number
  rate25Plus: number
  bustoutRate: number
  playsPerShow: number
  jamPerShow: number
  avgLengthMs: number
  medianLengthMs: number
}

/** PVS component breakdown for a single performance */
export interface PVSComponents {
  lengthValue: number
  jamBonus: number
  bustoutValue: number
  setLeverage: number
  runLeverage: number
  rarityValue: number
}

/** PVS result for a single performance */
export interface PerformancePVS {
  songName: string
  showDate: string
  pvs: number
  components: PVSComponents
}

/** Year-level duration stats for z-score computation */
export interface YearDurationStats {
  year: number
  meanDurationMs: number
  stdDevDurationMs: number
  totalPerformances: number
}

/** Per-song WAR */
export interface SongWAR {
  songName: string
  careerWAR: number
  warPerPlay: number
  warPerShow: number
  peakWARYear: number
  warByYear: Record<number, number>
}

/** Per-song JIS (Jam Impact Score) */
export interface SongJIS {
  songName: string
  avgJIS: number
  peakJIS: number
  jisVolatility: number
}

/** Complete leaderboard row */
export interface LeaderboardEntry {
  songName: string
  counting: SongCountingStats
  rates: SongRateStats
  war: SongWAR
  jis: SongJIS
}

/** Filter state for PhanGraphs queries */
export interface PhanGraphsFilter {
  yearStart: number
  yearEnd: number
  minTimesPlayed: number
  minShowsAppeared: number
  minJamchartCount: number
  minTotalMinutes: number
  setSplit: 'all' | 'set1' | 'set2' | 'set3' | 'encore' | 'opener' | 'closer'
}

/** Default filter values */
export const DEFAULT_FILTER: PhanGraphsFilter = {
  yearStart: 2009,
  yearEnd: new Date().getFullYear(),
  minTimesPlayed: 5,
  minShowsAppeared: 3,
  minJamchartCount: 0,
  minTotalMinutes: 0,
  setSplit: 'all',
}
