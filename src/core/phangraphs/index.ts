/**
 * PhanGraphs barrel export.
 * All public types and computation functions.
 */

// Types
export type {
  ShowIndex, RunType, BustoutTier, SetPosition,
  SongCountingStats, SongRateStats,
  PVSComponents, PerformancePVS, YearDurationStats,
  SongWAR, SongJIS,
  LeaderboardEntry, PhanGraphsFilter,
  AggregationKey, AggregatedLeaderboardEntry,
  TourInfo, VenueRunInfo, RunPositionFilter,
  TrackRow,
} from './types'
export { DEFAULT_FILTER, RUN_LEVERAGE, BUSTOUT_BONUS } from './types'

// Core computation
export { buildShowIndex } from './show-index'
export { classifyRuns, classifyShow } from './run-classifier'
export { computeCountingStats, classifyBustout, bustoutScore } from './counting-stats'
export { computeRateStats, median } from './rate-stats'
export { computeYearDurationStats, computeAllPVS, classifySetPosition, setLeverage, computeRarity, durationZScore } from './pvs'
export { computeReplacementLevels, computeWAR, percentile } from './war'
export { computeJIS, normalizeToJIS } from './jis'
export { filterTracks, applyQualifications } from './filters'

// New modules
export { parseState, isUSLocation, extractUniqueStates, extractUniqueVenues } from './location-utils'
export { classifyVenueRuns } from './venue-runs'
export { identifyTours, buildTourDateMap, seasonLabel } from './tour-classifier'

// Orchestrator
export { computeLeaderboard, computeLeaderboardFromTracks, computeAggregatedLeaderboard } from './leaderboard'
