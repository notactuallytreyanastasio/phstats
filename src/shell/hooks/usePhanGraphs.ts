import { useState, useEffect, useMemo } from 'react'
import { loadTracks } from '../api/static-queries'
import { computeLeaderboard } from '../../core/phangraphs/leaderboard'
import type { LeaderboardEntry, PhanGraphsFilter, TrackRow } from '../../core/phangraphs/types'
import { DEFAULT_FILTER } from '../../core/phangraphs/types'
import { getParam, setParams } from '../url-params'

type SortColumn = 'war' | 'warPerPlay' | 'warPerShow' | 'avgJIS' | 'peakJIS' | 'timesPlayed' | 'jamRate' | 'jamchartCount'

function initFilter(): PhanGraphsFilter {
  return {
    yearStart: parseInt(getParam('ys') ?? '') || DEFAULT_FILTER.yearStart,
    yearEnd: parseInt(getParam('ye') ?? '') || DEFAULT_FILTER.yearEnd,
    minTimesPlayed: parseInt(getParam('mtp') ?? '') || DEFAULT_FILTER.minTimesPlayed,
    minShowsAppeared: parseInt(getParam('msa') ?? '') || DEFAULT_FILTER.minShowsAppeared,
    minJamchartCount: parseInt(getParam('mjc') ?? '0'),
    minTotalMinutes: parseInt(getParam('mtm') ?? '0'),
    setSplit: (getParam('set') as PhanGraphsFilter['setSplit']) || DEFAULT_FILTER.setSplit,
  }
}

function initSortCol(): SortColumn {
  const col = getParam('col')
  const valid: SortColumn[] = ['war', 'warPerPlay', 'warPerShow', 'avgJIS', 'peakJIS', 'timesPlayed', 'jamRate', 'jamchartCount']
  return valid.includes(col as SortColumn) ? col as SortColumn : 'war'
}

function initSortDir(): 'asc' | 'desc' {
  return getParam('dir') === 'asc' ? 'asc' : 'desc'
}

export function usePhanGraphs() {
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PhanGraphsFilter>(initFilter)
  const [sortCol, setSortCol] = useState<SortColumn>(initSortCol)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initSortDir)

  // Load tracks once
  useEffect(() => {
    loadTracks().then(t => {
      setTracks(t)
      setLoading(false)
    })
  }, [])

  // Sync filter state to URL params
  useEffect(() => {
    setParams({
      ys: filter.yearStart !== DEFAULT_FILTER.yearStart ? String(filter.yearStart) : null,
      ye: filter.yearEnd !== DEFAULT_FILTER.yearEnd ? String(filter.yearEnd) : null,
      mtp: filter.minTimesPlayed !== DEFAULT_FILTER.minTimesPlayed ? String(filter.minTimesPlayed) : null,
      msa: filter.minShowsAppeared !== DEFAULT_FILTER.minShowsAppeared ? String(filter.minShowsAppeared) : null,
      mjc: filter.minJamchartCount !== 0 ? String(filter.minJamchartCount) : null,
      mtm: filter.minTotalMinutes !== 0 ? String(filter.minTotalMinutes) : null,
      set: filter.setSplit !== 'all' ? filter.setSplit : null,
      col: sortCol !== 'war' ? sortCol : null,
      dir: sortDir !== 'desc' ? sortDir : null,
    })
  }, [filter, sortCol, sortDir])

  // Compute leaderboard (memoized to avoid recomputation on sort changes)
  const entries = useMemo<LeaderboardEntry[]>(() => {
    if (tracks.length === 0) return []
    return computeLeaderboard(tracks, filter)
  }, [tracks, filter])

  return { entries, filter, setFilter, loading, sortCol, setSortCol, sortDir, setSortDir }
}
