import { useRef, useEffect, useState, useCallback } from 'react'
import Joyride, { STATUS } from 'react-joyride'
import type { CallBackProps, Step } from 'react-joyride'
import * as dataSource from '../api/data-source'
import { getParam, setParams } from '../url-params'

interface Track {
  song_name: string
  show_date: string
  set_name: string
  position: number
  duration_ms: number
  duration_min: number | null
  likes: number
  is_jamchart: number
  jam_notes: string
  venue: string
  location: string
  jam_url: string
}

interface SongHistory {
  song_name: string
  tracks: Track[]
}

interface SongOption {
  song_name: string
  times_played: number
  jamchart_count: number
  jamchart_pct: number
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '?'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtAvg(s: SongOption): string {
  if (s.times_played === 0) return '.000'
  const avg = s.jamchart_count / s.times_played
  return avg >= 1 ? '1.000' : ('.' + Math.round(avg * 1000).toString().padStart(3, '0'))
}

function battingAvg(s: SongOption): number {
  return s.times_played > 0 ? s.jamchart_count / s.times_played : 0
}

type ListFilter = 'all' | 'jamcharts'

const MOBILE_TOUR_KEY = 'phstats-mobile-tour-seen'

export default function SongDeepDiveMobile({ year, years, onYearChange }: { year: string; years: number[]; onYearChange: (y: string) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [songList, setSongList] = useState<SongOption[]>([])
  const [selectedSong, setSelectedSong] = useState(() => getParam('song') || '')
  const [songListLoaded, setSongListLoaded] = useState(false)
  const [data, setData] = useState<SongHistory | null>(null)
  const [nowPlaying, setNowPlaying] = useState<{ url: string; date: string; song: string } | null>(null)
  const [playbackTime, setPlaybackTime] = useState({ current: 0, duration: 0 })
  const [listFilter, setListFilter] = useState<ListFilter>('jamcharts')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [highlightJam, setHighlightJam] = useState<string | null>(() => getParam('jam') || null)
  const [cardFlipped, setCardFlipped] = useState(() => !!getParam('jam'))
  const highlightRef = useRef<HTMLDivElement>(null)
  const [sortBy, setSortBy] = useState<'avg' | 'jc' | 'played'>(() => {
    const s = getParam('sort')
    return s === 'jc' || s === 'played' ? s : 'avg'
  })
  const [minPlayed, setMinPlayed] = useState(() => {
    const m = getParam('min')
    return m ? parseInt(m, 10) || 5 : 5
  })
  const [runTour, setRunTour] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeTransition, setSwipeTransition] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  // Start tour for first-time mobile visitors once song list loads
  useEffect(() => {
    if (!songListLoaded || songList.length === 0) return
    if (localStorage.getItem(MOBILE_TOUR_KEY)) return
    if (window.location.search) return
    const t = setTimeout(() => setRunTour(true), 800)
    return () => clearTimeout(t)
  }, [songListLoaded, songList.length])

  const tourSteps: Step[] = [
    {
      target: '[data-tour-m="year-picker"]',
      title: 'Pick a Year',
      content: 'Filter all data to a single year, or view all of Phish 3.0 (2009\u2013now).',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour-m="song-picker"]',
      title: 'Choose a Song',
      content: 'Songs are sorted by batting average \u2014 the ratio of jamchart entries to times played. Higher avg = more consistently jammed.',
      placement: 'bottom',
    },
    {
      target: '[data-tour-m="sort-pills"]',
      title: 'Sort & Filter',
      content: 'Sort by batting avg, jamchart count, or times played. Use the dropdown to set a minimum play count.',
      placement: 'bottom',
    },
    {
      target: '[data-tour-m="baseball-card"]',
      title: 'The Baseball Card',
      content: 'Key stats at a glance. Tap the card to flip it and see every jam with play buttons. Filter by jamcharts or all performances. Scroll through and tap the green button to play any jam clip.',
      placement: 'bottom',
    },
  ]

  function handleTourCallback(data: CallBackProps) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRunTour(false)
      localStorage.setItem(MOBILE_TOUR_KEY, 'true')
    }
  }

  const playJam = useCallback((url: string, date: string, song: string) => {
    if (nowPlaying?.url === url) {
      if (audioRef.current?.paused) {
        audioRef.current.play()
      } else {
        audioRef.current?.pause()
      }
      return
    }
    setNowPlaying({ url, date, song })
    setHighlightJam(date)
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play()
    }
  }, [nowPlaying])

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setNowPlaying(null)
    setHighlightJam(null)
  }, [])

  const navigateSong = useCallback((direction: 'next' | 'prev') => {
    if (sortedSongs.length === 0) return
    const currentIdx = sortedSongs.findIndex(s => s.song_name === selectedSong)
    const nextIdx = direction === 'next'
      ? (currentIdx + 1) % sortedSongs.length
      : (currentIdx - 1 + sortedSongs.length) % sortedSongs.length
    setSwipeTransition(true)
    setSwipeOffset(direction === 'next' ? -window.innerWidth : window.innerWidth)
    setTimeout(() => {
      setSelectedSong(sortedSongs[nextIdx].song_name)
      setHighlightJam(null)
      setSwipeOffset(direction === 'next' ? window.innerWidth : -window.innerWidth)
      requestAnimationFrame(() => {
        setSwipeTransition(true)
        setSwipeOffset(0)
        setTimeout(() => setSwipeTransition(false), 300)
      })
    }, 200)
  }, [sortedSongs, selectedSong])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    // Only track horizontal swipes (not vertical scrolling)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setSwipeOffset(dx * 0.4) // dampened follow
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    const elapsed = Date.now() - touchStartRef.current.time
    touchStartRef.current = null

    // Require mostly horizontal swipe, min 60px or fast flick
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && (Math.abs(dx) > 60 || (Math.abs(dx) > 30 && elapsed < 300))) {
      navigateSong(dx < 0 ? 'next' : 'prev')
    } else {
      setSwipeOffset(0)
    }
  }, [navigateSong])

  // Sync state to URL params
  useEffect(() => {
    if (!songListLoaded) return
    setParams({
      song: selectedSong || null,
      sort: sortBy === 'avg' ? null : sortBy,
      min: minPlayed === 5 ? null : String(minPlayed),
      jam: highlightJam || null,
    })
  }, [selectedSong, sortBy, minPlayed, songListLoaded, highlightJam])

  // Load song list
  useEffect(() => {
    dataSource.fetchSongList(year)
      .then((list: SongOption[]) => {
        setSongList(list)
        if (list.length > 0) {
          const urlSong = selectedSong
          const match = list.find((s: SongOption) => s.song_name === urlSong)
          if (match) {
            if (match.times_played < minPlayed) {
              setMinPlayed(Math.max(1, match.times_played))
            }
          } else if (!urlSong) {
            setSelectedSong(list[0].song_name)
          } else {
            setSelectedSong(list[0].song_name)
          }
        }
        setSongListLoaded(true)
      })
      .catch(() => { setSongListLoaded(true) })
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch history
  useEffect(() => {
    if (!selectedSong) return
    setData(null)
    setExpandedIdx(null)
    // Keep card flipped if we have a highlighted jam to show
    if (!highlightJam) setCardFlipped(false)
    dataSource.fetchSongHistory(selectedSong, year)
      .then(setData)
      .catch(() => {})
  }, [selectedSong, year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to highlighted jam when card flips and data loads
  useEffect(() => {
    if (cardFlipped && highlightJam && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
    }
  }, [cardFlipped, highlightJam, data])

  // Song list filtering & sorting
  const filteredSongs = songList
    .filter(s => s.times_played >= minPlayed || s.song_name === selectedSong)

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    if (sortBy === 'avg') return battingAvg(b) - battingAvg(a) || b.jamchart_count - a.jamchart_count
    if (sortBy === 'jc') return b.jamchart_count - a.jamchart_count || battingAvg(b) - battingAvg(a)
    return b.times_played - a.times_played
  })

  // Current song stats
  const currentSongOption = songList.find(s => s.song_name === selectedSong)
  const tracks = data?.tracks ?? []
  const filteredTracks = tracks.filter(t => {
    if (listFilter === 'jamcharts') return t.is_jamchart
    return true
  })
  const jcCount = tracks.filter(t => t.is_jamchart).length
  const avgDur = tracks.length > 0
    ? tracks.reduce((sum, t) => sum + t.duration_ms, 0) / tracks.length
    : 0
  const longestMs = tracks.length > 0
    ? Math.max(...tracks.map(t => t.duration_ms))
    : 0
  const longestTrack = tracks.length > 0
    ? tracks.reduce((a, b) => (a.duration_ms > b.duration_ms ? a : b))
    : null
  const mostLovedTrack = tracks.length > 0
    ? tracks.reduce((a, b) => ((a.likes || 0) > (b.likes || 0) ? a : b))
    : null
  const notableQuote = tracks
    .filter(t => t.is_jamchart && t.jam_notes)
    .map(t => t.jam_notes)[0] || null
  const truncQuote = notableQuote
    ? (notableQuote.length > 80 ? notableQuote.slice(0, 80) + '...' : notableQuote)
    : null

  // Audio availability
  const audioCount = tracks.filter(t => t.jam_url).length

  // JC streak: consecutive jamcharts from most recent backwards
  let jcStreak = 0
  for (let i = tracks.length - 1; i >= 0; i--) {
    if (tracks[i].is_jamchart) jcStreak++
    else break
  }

  // Set placement
  const setGroups = new Map<string, { total: number; jc: number }>()
  for (const t of tracks) {
    const s = t.set_name || 'Unknown'
    const entry = setGroups.get(s) || { total: 0, jc: 0 }
    entry.total++
    if (t.is_jamchart) entry.jc++
    setGroups.set(s, entry)
  }
  let dominantSet = '', dominantSetPct = 0
  for (const [s, { total }] of setGroups) {
    const pct = Math.round(100 * total / tracks.length)
    if (pct > dominantSetPct) { dominantSet = s; dominantSetPct = pct }
  }
  const fmtSet = (s: string) => {
    if (s === 'SET 1') return 'Set 1'
    if (s === 'SET 2') return 'Set 2'
    if (s === 'SET 3') return 'Set 3'
    if (s === 'ENCORE') return 'Encore'
    if (s === 'ENCORE 2') return 'Encore 2'
    return s
  }
  const jcTracks = tracks.filter(t => t.is_jamchart)
  let jcSetNote: string | null = null
  if (jcTracks.length >= 2) {
    const jcSetGroups = new Map<string, number>()
    for (const t of jcTracks) jcSetGroups.set(t.set_name, (jcSetGroups.get(t.set_name) || 0) + 1)
    let topJcSet = '', topJcCount = 0
    for (const [s, count] of jcSetGroups) {
      if (count > topJcCount) { topJcSet = s; topJcCount = count }
    }
    if (Math.round(100 * topJcCount / jcTracks.length) >= 75) {
      jcSetNote = `${topJcCount}/${jcTracks.length} JCs from ${fmtSet(topJcSet)}`
    }
  }

  // Gap / last played
  const lastPlayedDate = tracks.length > 0 ? tracks[tracks.length - 1].show_date : null
  const daysSince = lastPlayedDate
    ? Math.floor((Date.now() - new Date(lastPlayedDate).getTime()) / 86400000)
    : null
  const avgGapDays = tracks.length > 1
    ? Math.round((new Date(tracks[tracks.length - 1].show_date).getTime() - new Date(tracks[0].show_date).getTime()) / 86400000 / (tracks.length - 1))
    : null

  // Best year by JC rate (min 2 plays)
  const yearGroups = new Map<string, { total: number; jc: number }>()
  for (const t of tracks) {
    const yr = t.show_date.slice(0, 4)
    const entry = yearGroups.get(yr) || { total: 0, jc: 0 }
    entry.total++
    if (t.is_jamchart) entry.jc++
    yearGroups.set(yr, entry)
  }
  let bestYear = '', bestYearJc = 0, bestYearTotal = 0, bestYearPct = 0
  for (const [yr, { total, jc }] of yearGroups) {
    if (total >= 2) {
      const pct = jc / total
      if (pct > bestYearPct || (pct === bestYearPct && jc > bestYearJc)) {
        bestYear = yr; bestYearJc = jc; bestYearTotal = total; bestYearPct = pct
      }
    }
  }

  const pill = (label: string, value: ListFilter, count: number) => (
    <button
      key={value}
      onClick={() => setListFilter(value)}
      style={{
        padding: '6px 14px',
        borderRadius: '20px',
        border: listFilter === value ? '2px solid #ef4444' : '1px solid #334155',
        background: listFilter === value ? '#ef4444' : '#1e293b',
        color: listFilter === value ? 'white' : '#94a3b8',
        fontSize: '13px',
        fontWeight: listFilter === value ? 700 : 400,
        cursor: 'pointer',
      }}
    >
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  )

  const fmtSec = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: '100vw', paddingBottom: nowPlaying ? 72 : 0 }}>
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        scrollToFirstStep
        callback={handleTourCallback}
        styles={{
          options: { primaryColor: '#ef4444', zIndex: 10000 },
          tooltip: { borderRadius: 8 },
          buttonNext: { borderRadius: 6 },
          buttonBack: { color: '#666' },
        }}
        locale={{ last: 'Let\'s go!', skip: 'Skip tour' }}
      />

      {/* Sticky song picker */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', padding: '8px 12px',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '16px', color: '#111' }}>phstats</span>
          <select
            data-tour-m="year-picker"
            value={year}
            onChange={e => onYearChange(e.target.value)}
            style={{
              marginLeft: 'auto', padding: '6px 8px', fontSize: '13px',
              borderRadius: '6px', border: '1px solid #d1d5db',
              background: '#fff', fontWeight: 600,
            }}
          >
            <option value="all">All 3.0</option>
            {years.map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
        <select
          data-tour-m="song-picker"
          value={selectedSong}
          onChange={e => { setSelectedSong(e.target.value); setListFilter('all') }}
          style={{
            width: '100%', padding: '10px 12px', fontSize: '15px',
            borderRadius: '8px', border: '1px solid #d1d5db',
            background: '#fff',
          }}
        >
          {sortedSongs.map(s => (
            <option key={s.song_name} value={s.song_name}>
              {fmtAvg(s)} — {s.song_name} ({s.jamchart_count} JC / {s.times_played}×)
            </option>
          ))}
        </select>
        <div data-tour-m="sort-pills" style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
          {(['avg', 'jc', 'played'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSortBy(mode)}
              style={{
                padding: '4px 12px', borderRadius: '14px',
                border: sortBy === mode ? '2px solid #333' : '1px solid #ccc',
                background: sortBy === mode ? '#333' : '#fff',
                color: sortBy === mode ? '#fff' : '#666',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {mode === 'avg' ? 'AVG' : mode === 'jc' ? 'JC' : 'PLAYED'}
            </button>
          ))}
          <select
            value={minPlayed}
            onChange={e => setMinPlayed(Number(e.target.value))}
            style={{
              marginLeft: 'auto', padding: '4px 6px', fontSize: '12px',
              borderRadius: '6px', border: '1px solid #ccc',
              background: '#fff', fontWeight: 600,
            }}
          >
            {[1, 2, 3, 5, 8, 10, 15, 20, 30, 50].map(n => (
              <option key={n} value={n}>Min {n}×</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {!data && selectedSong && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading...</div>
      )}

      {/* Song position indicator */}
      {sortedSongs.length > 1 && selectedSong && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
          padding: '8px 12px 0', fontSize: '12px', color: '#94a3b8',
        }}>
          <span style={{ color: '#64748b' }}>
            {sortedSongs.findIndex(s => s.song_name === selectedSong) + 1} / {sortedSongs.length}
          </span>
          <span style={{ color: '#475569', fontSize: '10px', letterSpacing: '1px' }}>SWIPE TO BROWSE</span>
        </div>
      )}

      {/* Baseball card — 3D flip */}
      {currentSongOption && data && (
        <div
          data-tour-m="baseball-card"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            margin: '12px',
            perspective: '1200px',
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeTransition ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          <div style={{
            position: 'relative',
            height: cardFlipped ? `calc(100vh - ${nowPlaying ? 200 : 140}px)` : 'auto',
          }}>
            {/* FRONT — hero stats */}
            <div
              onClick={() => setCardFlipped(true)}
              style={{
                padding: '20px', borderRadius: '16px',
                background: '#1a1a2e', color: 'white',
                border: '2px solid #334155', textAlign: 'center',
                cursor: 'pointer',
                display: cardFlipped ? 'none' : 'block',
              }}
            >
              <div style={{
                fontSize: '22px', fontWeight: 800, letterSpacing: '1px',
                textTransform: 'uppercase', marginBottom: '4px',
              }}>
                {data.song_name}
              </div>
              <div style={{
                width: '40px', height: '2px', background: '#ef4444',
                margin: '0 auto 16px',
              }} />
              <div style={{
                fontSize: '52px', fontWeight: 900, lineHeight: 1,
                color: '#ef4444', marginBottom: '4px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtAvg(currentSongOption)}
              </div>
              <div style={{
                fontSize: '11px', fontWeight: 600, letterSpacing: '2px',
                color: '#64748b', textTransform: 'uppercase', marginBottom: '16px',
              }}>
                BATTING AVG
              </div>
              <div style={{
                display: 'flex', justifyContent: 'center', gap: '16px',
                fontSize: '14px', color: '#94a3b8',
              }}>
                <span><strong style={{ color: '#ef4444' }}>{currentSongOption.jamchart_count}</strong> JC</span>
                <span style={{ color: '#334155' }}>·</span>
                <span><strong style={{ color: 'white' }}>{currentSongOption.times_played}</strong>× played</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'center', gap: '16px',
                fontSize: '13px', color: '#64748b', marginTop: '6px',
              }}>
                <span>Avg {(avgDur / 60000).toFixed(1)}m</span>
                <span style={{ color: '#334155' }}>·</span>
                <span>Peak {fmtDuration(longestMs)}</span>
                <span style={{ color: '#334155' }}>·</span>
                <span style={audioCount === 0 ? { color: '#ef4444' } : {}}>🎧 {audioCount}/{tracks.length}</span>
              </div>
              {/* Extended stats */}
              {longestTrack && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #334155', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>
                    <span style={{ color: '#ef4444' }}>★</span> Longest: {fmtDuration(longestTrack.duration_ms)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                    {longestTrack.show_date} · {longestTrack.venue}
                  </div>
                </div>
              )}
              {mostLovedTrack && (mostLovedTrack.likes || 0) > 0 && (
                <div style={{ marginTop: '8px', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>
                    <span style={{ color: '#ef4444' }}>♥</span> Most Loved: {mostLovedTrack.likes} likes
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                    {mostLovedTrack.show_date} · {mostLovedTrack.venue}
                  </div>
                </div>
              )}
              {/* Set placement */}
              {dominantSet && (
                <div style={{ marginTop: '8px', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>
                    📊 {dominantSetPct}% {fmtSet(dominantSet)}{jcSetNote ? ` · ${jcSetNote}` : ''}
                  </div>
                </div>
              )}
              {/* Gap */}
              {lastPlayedDate && (
                <div style={{ marginTop: '4px', textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Last: <strong style={{ color: '#e2e8f0' }}>{lastPlayedDate}</strong> ({daysSince}d ago){avgGapDays ? ` · avg every ${avgGapDays}d` : ''}
                  </div>
                </div>
              )}
              {/* Best year */}
              {bestYear && bestYearJc > 0 && (
                <div style={{ marginTop: '4px', textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Best year: <strong style={{ color: '#e2e8f0' }}>{bestYear}</strong> — {bestYearJc}/{bestYearTotal} JC
                  </div>
                </div>
              )}
              {/* JC Streak */}
              {jcStreak > 0 && (
                <div style={{ marginTop: '4px', textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    🔥 JC Streak: <strong style={{ color: '#e2e8f0' }}>{jcStreak}</strong> in a row
                  </div>
                </div>
              )}
              {/* Notable quote */}
              {truncQuote && (
                <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b', fontStyle: 'italic', lineHeight: 1.4, textAlign: 'left' }}>
                  "{truncQuote}"
                </div>
              )}
              <div style={{
                fontSize: '11px', color: '#22c55e', marginTop: '16px',
                letterSpacing: '1px', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                TAP TO FLIP
              </div>
            </div>

            {/* BACK — all jams, scrollable */}
            <div style={{
              borderRadius: '16px',
              background: '#1a1a2e', color: 'white',
              border: '2px solid #334155',
              display: cardFlipped ? 'flex' : 'none',
              flexDirection: 'column' as const,
              height: '100%',
              overflow: 'hidden',
            }}>
              {/* Back header — tap to flip back */}
              <div
                onClick={() => setCardFlipped(false)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #334155',
                  cursor: 'pointer',
                  textAlign: 'center', flexShrink: 0,
                }}
              >
                <div style={{
                  fontSize: '13px', fontWeight: 800, letterSpacing: '1px',
                  color: '#e2e8f0', textTransform: 'uppercase',
                }}>
                  {data.song_name}
                  <span style={{ color: '#ef4444', marginLeft: '8px' }}>{fmtAvg(currentSongOption)}</span>
                </div>
                <div style={{
                  fontSize: '10px', color: '#475569', marginTop: '4px',
                  letterSpacing: '1px', textTransform: 'uppercase',
                }}>
                  TAP TO FLIP BACK
                </div>
              </div>

              {/* Filter pills inside card */}
              <div data-tour-m="filter-pills" style={{
                display: 'flex', gap: '8px', padding: '10px 16px',
                borderBottom: '1px solid #334155', flexShrink: 0,
              }}>
                {pill('All', 'all', tracks.length)}
                {pill('Jamcharts', 'jamcharts', jcCount)}
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', alignSelf: 'center' }}>
                  {filteredTracks.length} jams
                </span>
              </div>

              {/* Scrollable jam list */}
              <div data-tour-m="perf-list" style={{
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                flex: 1, padding: '4px 0',
              }}>
                {filteredTracks.map((t, i) => {
                  const isJc = !!t.is_jamchart
                  const isExpanded = expandedIdx === i
                  const isHighlighted = highlightJam === t.show_date
                  return (
                    <div
                      ref={isHighlighted ? highlightRef : undefined}
                      key={`${t.show_date}-${t.set_name}-${t.position}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px',
                        borderBottom: '1px solid #1e293b',
                        borderLeft: isHighlighted ? '3px solid #22c55e' : isJc ? '3px solid #ef4444' : '3px solid transparent',
                        background: isHighlighted ? 'rgba(34, 197, 94, 0.12)' : undefined,
                        boxShadow: isHighlighted ? 'inset 0 0 12px rgba(34, 197, 94, 0.15)' : undefined,
                      }}
                    >
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: t.jam_notes ? 'pointer' : 'default' }}
                        onClick={() => t.jam_notes ? setExpandedIdx(isExpanded ? null : i) : undefined}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>
                            {isJc && <span style={{ color: '#ef4444', marginRight: '4px' }}>&#9733;</span>}
                            {t.show_date}
                          </span>
                          <span style={{
                            fontSize: '16px', fontWeight: 900,
                            color: isJc ? '#ef4444' : '#94a3b8',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {fmtDuration(t.duration_ms)}
                          </span>
                        </div>
                        {/* Duration bar */}
                        {longestMs > 0 && t.duration_ms > 0 && (
                          <div style={{ height: 2, background: '#334155', borderRadius: 1, marginTop: '3px' }}>
                            <div style={{
                              height: '100%', borderRadius: 1,
                              width: `${Math.round(100 * t.duration_ms / longestMs)}%`,
                              background: isJc ? '#ef4444' : '#475569',
                            }} />
                          </div>
                        )}
                        <div style={{
                          fontSize: '11px', color: '#64748b', marginTop: '2px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {t.venue} · {t.location}
                        </div>
                        {/* Jam notes (expandable) */}
                        {t.jam_notes && (
                          <div style={{
                            marginTop: '4px',
                            fontSize: '11px', color: '#94a3b8', lineHeight: '1.4',
                            fontStyle: 'italic',
                            ...(!isExpanded ? {
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical' as const,
                              overflow: 'hidden',
                            } : {}),
                          }}>
                            {t.jam_notes}
                          </div>
                        )}
                      </div>
                      {t.jam_url && (
                        <button
                          onClick={() => playJam(t.jam_url, t.show_date, t.song_name)}
                          style={{
                            background: nowPlaying?.url === t.jam_url ? '#16a34a' : '#22c55e',
                            color: 'white', border: 'none', borderRadius: '50%',
                            width: '34px', height: '34px', fontSize: '14px',
                            cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {nowPlaying?.url === t.jam_url ? '\u23F8' : '\u25B6'}
                        </button>
                      )}
                    </div>
                  )
                })}
                {filteredTracks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                    No performances match this filter
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio element */}
      <audio
        ref={audioRef}
        onEnded={stopPlayback}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setPlaybackTime({ current: audioRef.current.currentTime, duration: audioRef.current.duration || 0 })
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setPlaybackTime({ current: 0, duration: audioRef.current.duration || 0 })
          }
        }}
      />

      {/* Mini player */}
      {nowPlaying && (() => {
        const pct = playbackTime.duration > 0 ? (playbackTime.current / playbackTime.duration) * 100 : 0
        return (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#1a1a2e', color: 'white',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.4)', zIndex: 1001,
            transform: 'translate3d(0,0,0)',
            WebkitTransform: 'translate3d(0,0,0)',
          }}>
            <div
              style={{ height: 4, background: '#334155', cursor: 'pointer' }}
              onClick={e => {
                if (!audioRef.current || !playbackTime.duration) return
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = (e.clientX - rect.left) / rect.width
                audioRef.current.currentTime = ratio * playbackTime.duration
              }}
            >
              <div style={{ height: '100%', width: `${pct}%`, background: '#22c55e', transition: 'width 0.2s linear' }} />
            </div>
            <div style={{
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: '12px',
              fontSize: '14px',
            }}>
              <button
                onClick={stopPlayback}
                style={{
                  background: 'none', border: 'none', color: '#ef4444',
                  cursor: 'pointer', fontSize: '22px', padding: '0 4px', lineHeight: 1,
                }}
              >&#9632;</button>
              <span style={{ color: '#22c55e', fontSize: '18px' }}>&#9654;</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                <span style={{
                  fontWeight: 700, fontSize: '14px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {nowPlaying.song}
                  <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: '6px' }}>{nowPlaying.date}</span>
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtSec(playbackTime.current)} / {fmtSec(playbackTime.duration)}
                </span>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
