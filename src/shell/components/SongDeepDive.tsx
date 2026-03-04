import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import * as dataSource from '../api/data-source'
import { getParam, setParams } from '../url-params'
import { tourFromDate, weekdayFromDate } from '../../core/phangraphs/date-utils'

type TourFilter = 'all' | 'Winter' | 'Spring' | 'Summer' | 'Fall' | 'Holiday'
type WeekdayFilter = 'all' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '?'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

type ViewMode = 'chart' | 'card'
type ListFilter = 'all' | 'jamcharts'

const CARD_HEIGHT = 420

function fmtAvgVal(s: SongOption): string {
  if (s.times_played === 0) return '.000'
  const avg = s.jamchart_count / s.times_played
  return avg >= 1 ? '1.000' : ('.' + Math.round(avg * 1000).toString().padStart(3, '0'))
}

function fmtSet(s: string) {
  if (s === 'SET 1') return 'S1'
  if (s === 'SET 2') return 'S2'
  if (s === 'SET 3') return 'S3'
  if (s === 'ENCORE') return 'Enc'
  if (s === 'ENCORE 2') return 'E2'
  return s
}

function buildShareUrl(song: string, jamDate?: string, view: 'chart' | 'card' = 'card'): string {
  const params = new URLSearchParams(window.location.search)
  params.set('song', song)
  params.set('view', view)
  if (jamDate) params.set('jam', jamDate)
  return window.location.origin + window.location.pathname + '?' + params.toString()
}

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text)
  }
  // Fallback for older browsers
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return Promise.resolve()
}

function SingleCard({
  songOption, data, isFlipped, onFlip,
  listFilter, setListFilter,
  playJam, nowPlaying, highlightDate,
}: {
  songOption: SongOption
  data: SongHistory | null
  isFlipped: boolean
  onFlip: () => void
  listFilter: ListFilter
  setListFilter: (v: ListFilter) => void
  playJam: (url: string, date: string, song: string) => void
  nowPlaying: { url: string; date: string; song: string } | null
  highlightDate: string | null
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const [shareToast, setShareToast] = useState<string | null>(null)

  const shareJam = (song: string, date: string) => {
    const url = buildShareUrl(song, date)
    copyToClipboard(url).then(() => {
      setShareToast(date)
      setTimeout(() => setShareToast(null), 2000)
    })
  }

  // Scroll to highlighted jam when card flips open
  useEffect(() => {
    if (isFlipped && highlightDate && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400)
    }
  }, [isFlipped, highlightDate])

  if (!data) {
    return (
      <div style={{
        height: CARD_HEIGHT, borderRadius: '12px',
        background: '#1a1a2e', border: '2px solid #334155',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: '13px',
      }}>
        Loading...
      </div>
    )
  }

  const tracks = data.tracks
  const jcCount = tracks.filter(t => t.is_jamchart).length
  const avgDur = tracks.length > 0
    ? tracks.reduce((sum, t) => sum + t.duration_ms, 0) / tracks.length : 0
  const longestMs = tracks.length > 0 ? Math.max(...tracks.map(t => t.duration_ms)) : 0
  const longestTrack = tracks.length > 0
    ? tracks.reduce((a, b) => (a.duration_ms > b.duration_ms ? a : b)) : null
  const audioCount = tracks.filter(t => t.jam_url).length

  // Best year
  const yearGroups = new Map<string, { total: number; jc: number }>()
  for (const t of tracks) {
    const yr = t.show_date.slice(0, 4)
    const e = yearGroups.get(yr) || { total: 0, jc: 0 }
    e.total++; if (t.is_jamchart) e.jc++
    yearGroups.set(yr, e)
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

  // Set placement
  const setGroups = new Map<string, number>()
  for (const t of tracks) setGroups.set(t.set_name || '?', (setGroups.get(t.set_name || '?') || 0) + 1)
  let topSet = '', topSetPct = 0
  for (const [s, n] of setGroups) {
    const pct = Math.round(100 * n / tracks.length)
    if (pct > topSetPct) { topSet = s; topSetPct = pct }
  }

  // JC streak
  let jcStreak = 0
  for (let i = tracks.length - 1; i >= 0; i--) {
    if (tracks[i].is_jamchart) jcStreak++; else break
  }

  const filteredTracks = tracks.filter(t => listFilter === 'jamcharts' ? t.is_jamchart : true)

  const pill = (label: string, value: ListFilter, count: number) => (
    <button
      key={value}
      onClick={(e) => { e.stopPropagation(); setListFilter(value) }}
      style={{
        padding: '4px 10px', borderRadius: '14px',
        border: listFilter === value ? '2px solid #ef4444' : '1px solid #334155',
        background: listFilter === value ? '#ef4444' : '#1e293b',
        color: listFilter === value ? 'white' : '#94a3b8',
        fontSize: '11px', fontWeight: listFilter === value ? 700 : 400,
        cursor: 'pointer',
      }}
    >
      {label} ({count})
    </button>
  )

  return (
    <div style={{ perspective: '1000px', height: CARD_HEIGHT }}>
      <div style={{
        position: 'relative', height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s ease',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* FRONT */}
        <div
          onClick={onFlip}
          style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            padding: '16px', borderRadius: '12px',
            background: '#1a1a2e', color: 'white',
            border: '2px solid #334155', textAlign: 'center',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div style={{
            fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px',
            textTransform: 'uppercase', marginBottom: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.song_name}
          </div>
          <div style={{ width: '30px', height: '2px', background: '#ef4444', margin: '0 auto 10px' }} />
          <div style={{
            fontSize: '40px', fontWeight: 900, lineHeight: 1,
            color: '#ef4444', marginBottom: '2px',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtAvgVal(songOption)}
          </div>
          <div style={{
            fontSize: '9px', fontWeight: 600, letterSpacing: '2px',
            color: '#64748b', textTransform: 'uppercase', marginBottom: '10px',
          }}>
            BATTING AVG
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '12px', color: '#94a3b8' }}>
            <span><strong style={{ color: '#ef4444' }}>{songOption.jamchart_count}</strong> JC</span>
            <span style={{ color: '#334155' }}>&middot;</span>
            <span><strong style={{ color: 'white' }}>{songOption.times_played}</strong>&times;</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            <span>Avg {(avgDur / 60000).toFixed(1)}m</span>
            <span>&middot;</span>
            <span>Peak {fmtDuration(longestMs)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            <span style={audioCount === 0 ? { color: '#ef4444' } : {}}>&#127911; {audioCount}/{tracks.length}</span>
            {topSet && <span>&middot; {topSetPct}% {fmtSet(topSet)}</span>}
          </div>
          {longestTrack && (
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #334155', textAlign: 'left' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>
                <span style={{ color: '#ef4444' }}>&#9733;</span> Longest: {fmtDuration(longestTrack.duration_ms)}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {longestTrack.show_date} &middot; {longestTrack.venue}
              </div>
            </div>
          )}
          {bestYear && bestYearJc > 0 && (
            <div style={{ marginTop: '4px', textAlign: 'left' }}>
              <div style={{ fontSize: '9px', color: '#64748b' }}>
                Best: <strong style={{ color: '#e2e8f0' }}>{bestYear}</strong> &mdash; {bestYearJc}/{bestYearTotal} JC
              </div>
            </div>
          )}
          {jcStreak > 0 && (
            <div style={{ marginTop: '2px', textAlign: 'left' }}>
              <div style={{ fontSize: '9px', color: '#64748b' }}>
                &#128293; Streak: <strong style={{ color: '#e2e8f0' }}>{jcStreak}</strong> in a row
              </div>
            </div>
          )}
          <div style={{
            fontSize: '10px', color: '#22c55e', marginTop: '10px',
            letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700,
          }}>
            CLICK TO FLIP
          </div>
        </div>

        {/* BACK */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          borderRadius: '12px', background: '#1a1a2e', color: 'white',
          border: '2px solid #334155',
          display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
        }}>
          <div onClick={onFlip} style={{
            padding: '8px 12px', borderBottom: '1px solid #334155',
            cursor: 'pointer', textAlign: 'center', flexShrink: 0,
          }}>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px', color: '#e2e8f0', textTransform: 'uppercase' }}>
              {data.song_name}
              <span style={{ color: '#ef4444', marginLeft: '6px' }}>{fmtAvgVal(songOption)}</span>
            </div>
            <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              CLICK TO FLIP BACK
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', padding: '6px 12px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
            {pill('All', 'all', tracks.length)}
            {pill('JC', 'jamcharts', jcCount)}
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', alignSelf: 'center' }}>
              {filteredTracks.length}
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '2px 0' }}>
            {filteredTracks.map((t, i) => {
              const isJc = !!t.is_jamchart
              const isExp = expandedIdx === i
              const isHighlighted = highlightDate === t.show_date
              return (
                <div
                  ref={isHighlighted ? highlightRef : undefined}
                  key={`${t.show_date}-${t.set_name}-${t.position}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px',
                    borderBottom: '1px solid #1e293b',
                    borderLeft: isHighlighted ? '3px solid #22c55e' : isJc ? '3px solid #ef4444' : '3px solid transparent',
                    background: isHighlighted ? 'rgba(34, 197, 94, 0.12)' : undefined,
                    boxShadow: isHighlighted ? 'inset 0 0 12px rgba(34, 197, 94, 0.15)' : undefined,
                  }}
                >
                  <div
                    style={{ flex: 1, minWidth: 0, cursor: t.jam_notes ? 'pointer' : 'default' }}
                    onClick={(e) => { e.stopPropagation(); t.jam_notes ? setExpandedIdx(isExp ? null : i) : undefined }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>
                        {isJc && <span style={{ color: '#ef4444', marginRight: '3px' }}>&#9733;</span>}
                        {t.show_date}
                      </span>
                      <span style={{
                        fontSize: '13px', fontWeight: 900,
                        color: isJc ? '#ef4444' : '#94a3b8',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {fmtDuration(t.duration_ms)}
                      </span>
                    </div>
                    {longestMs > 0 && t.duration_ms > 0 && (
                      <div style={{ height: 2, background: '#334155', borderRadius: 1, marginTop: '2px' }}>
                        <div style={{
                          height: '100%', borderRadius: 1,
                          width: `${Math.round(100 * t.duration_ms / longestMs)}%`,
                          background: isJc ? '#ef4444' : '#475569',
                        }} />
                      </div>
                    )}
                    <div style={{
                      fontSize: '10px', color: '#64748b', marginTop: '1px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.venue}
                    </div>
                    {t.jam_notes && (
                      <div style={{
                        marginTop: '3px', fontSize: '10px', color: '#94a3b8',
                        lineHeight: '1.3', fontStyle: 'italic',
                        ...(!isExp ? {
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        } : {}),
                      }}>
                        {t.jam_notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); shareJam(t.song_name, t.show_date) }}
                      title="Share this jam"
                      style={{
                        background: 'none', border: 'none',
                        color: shareToast === t.show_date ? '#22c55e' : '#475569',
                        cursor: 'pointer', fontSize: '14px', padding: '2px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {shareToast === t.show_date ? '\u2713' : '\u21AA'}
                    </button>
                    {t.jam_url && (
                      <button
                        onClick={(e) => { e.stopPropagation(); playJam(t.jam_url, t.show_date, t.song_name) }}
                        style={{
                          background: nowPlaying?.url === t.jam_url ? '#16a34a' : '#22c55e',
                          color: 'white', border: 'none', borderRadius: '50%',
                          width: '30px', height: '30px', fontSize: '12px',
                          cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {nowPlaying?.url === t.jam_url ? '\u23F8' : '\u25B6'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredTracks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '11px' }}>
                No performances match filter
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const GRID_SIZE = 12

function filterTracksByTourDay(tracks: Track[], tour: TourFilter, weekday: WeekdayFilter): Track[] {
  let result = tracks
  if (tour !== 'all') result = result.filter(t => tourFromDate(t.show_date) === tour)
  if (weekday !== 'all') result = result.filter(t => weekdayFromDate(t.show_date) === weekday)
  return result
}

function CardGrid({
  songs, year, tour, weekday, playJam, nowPlaying, highlightSong, highlightDate,
}: {
  songs: SongOption[]
  year: string
  tour: TourFilter
  weekday: WeekdayFilter
  playJam: (url: string, date: string, song: string) => void
  nowPlaying: { url: string; date: string; song: string } | null
  highlightSong: string | null
  highlightDate: string | null
}) {
  const topSongs = songs.slice(0, GRID_SIZE)
  const [rawHistoryMap, setRawHistoryMap] = useState<Record<string, SongHistory>>({})
  const [flippedSet, setFlippedSet] = useState<Set<string>>(() => {
    // Auto-flip the highlighted song's card on initial load
    if (highlightSong && highlightDate) return new Set([highlightSong])
    return new Set()
  })
  const [listFilters, setListFilters] = useState<Record<string, ListFilter>>({})

  // Fetch history for all top songs
  useEffect(() => {
    setRawHistoryMap({})
    setFlippedSet(new Set())
    const names = topSongs.map(s => s.song_name)
    names.forEach(name => {
      dataSource.fetchSongHistory(name, year)
        .then(data => {
          setRawHistoryMap(prev => ({ ...prev, [name]: data }))
        })
        .catch(() => {})
    })
  }, [year, topSongs.map(s => s.song_name).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply tour/weekday filters to fetched histories
  const historyMap = useMemo(() => {
    const filtered: Record<string, SongHistory> = {}
    for (const [name, hist] of Object.entries(rawHistoryMap)) {
      filtered[name] = {
        song_name: hist.song_name,
        tracks: filterTracksByTourDay(hist.tracks, tour, weekday),
      }
    }
    return filtered
  }, [rawHistoryMap, tour, weekday])

  const toggleFlip = (name: string) => {
    setFlippedSet(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '16px',
    }}>
      {topSongs.map((s, i) => (
        <div key={s.song_name} style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '-8px', left: '-4px', zIndex: 2,
            background: '#ef4444', color: 'white',
            width: '24px', height: '24px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 800,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}>
            {i + 1}
          </div>
          <SingleCard
            songOption={s}
            data={historyMap[s.song_name] ?? null}
            isFlipped={flippedSet.has(s.song_name)}
            onFlip={() => toggleFlip(s.song_name)}
            listFilter={listFilters[s.song_name] ?? 'jamcharts'}
            setListFilter={(v) => setListFilters(prev => ({ ...prev, [s.song_name]: v }))}
            playJam={playJam}
            nowPlaying={nowPlaying}
            highlightDate={highlightSong === s.song_name ? highlightDate : null}
          />
        </div>
      ))}
    </div>
  )
}

export default function SongDeepDive({ year }: { year: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [songList, setSongList] = useState<SongOption[]>([])
  const [selectedSong, setSelectedSong] = useState(() => getParam('song') || '')
  const [songListLoaded, setSongListLoaded] = useState(false)
  const [data, setData] = useState<SongHistory | null>(null)
  const [filter, setFilter] = useState('')
  const [sidebarTrack, setSidebarTrack] = useState<Track | null>(null)
  const [sidebarShareToast, setSidebarShareToast] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<{ url: string; date: string; song: string } | null>(null)
  const [playbackTime, setPlaybackTime] = useState({ current: 0, duration: 0 })
  const [highlightJam, setHighlightJam] = useState<string | null>(() => getParam('jam') || null)
  const [playbarShareToast, setPlaybarShareToast] = useState(false)
  const [chartWidth, setChartWidth] = useState(800)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Auto-switch to card view if a jam is highlighted from URL
    if (getParam('jam')) return 'card'
    const v = getParam('view')
    if (v === 'card') return v
    return 'chart'
  })

  const shareNowPlaying = useCallback(() => {
    if (!nowPlaying) return
    const url = buildShareUrl(nowPlaying.song, nowPlaying.date, viewMode)
    copyToClipboard(url).then(() => {
      setPlaybarShareToast(true)
      setTimeout(() => setPlaybarShareToast(false), 2000)
    })
  }, [nowPlaying, viewMode])

  const shareSidebarTrack = useCallback(() => {
    if (!sidebarTrack) return
    const url = buildShareUrl(sidebarTrack.song_name, sidebarTrack.show_date, 'chart')
    copyToClipboard(url).then(() => {
      setSidebarShareToast(true)
      setTimeout(() => setSidebarShareToast(false), 2000)
    })
  }, [sidebarTrack])

  // Measure chart container width
  useEffect(() => {
    if (!chartContainerRef.current) return
    const measure = () => {
      if (chartContainerRef.current) {
        const sidebarWidth = sidebarTrack ? 340 : 0
        setChartWidth(Math.max(400, chartContainerRef.current.offsetWidth - sidebarWidth - 24))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(chartContainerRef.current)
    return () => observer.disconnect()
  }, [sidebarTrack])

  const [tour, setTour] = useState<TourFilter>(() => {
    const t = getParam('tour')
    return t && ['Winter', 'Spring', 'Summer', 'Fall', 'Holiday'].includes(t) ? t as TourFilter : 'all'
  })
  const [weekday, setWeekday] = useState<WeekdayFilter>(() => {
    const d = getParam('day')
    return d && ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(d) ? d as WeekdayFilter : 'all'
  })
  const [sortBy, setSortBy] = useState<'avg' | 'jc' | 'played'>(() => {
    const s = getParam('sort')
    return s === 'jc' || s === 'played' ? s : 'avg'
  })
  const [minPlayed, setMinPlayed] = useState(() => {
    const m = getParam('min')
    return m ? parseInt(m, 10) || 5 : 5
  })

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

  // Sync deep-dive state to URL params (only after song list loads to avoid clobbering shared link params)
  useEffect(() => {
    if (!songListLoaded) return
    setParams({
      song: selectedSong || null,
      sort: sortBy === 'avg' ? null : sortBy,
      min: minPlayed === 5 ? null : String(minPlayed),
      view: viewMode === 'chart' ? null : viewMode,
      tour: tour === 'all' ? null : tour,
      day: weekday === 'all' ? null : weekday,
      jam: highlightJam || null,
    })
  }, [selectedSong, sortBy, minPlayed, songListLoaded, viewMode, tour, weekday, highlightJam])

  // Load all tracks for year, derive song list with tour/weekday filters
  const [allTracks, setAllTracks] = useState<Track[]>([])
  useEffect(() => {
    dataSource.fetchAllTracks(year)
      .then((tracks: Track[]) => setAllTracks(tracks))
      .catch(() => setAllTracks([]))
  }, [year])

  useEffect(() => {
    const filtered = filterTracksByTourDay(allTracks, tour, weekday)
    const byName = new Map<string, { count: number; jc: number }>()
    for (const t of filtered) {
      let entry = byName.get(t.song_name)
      if (!entry) { entry = { count: 0, jc: 0 }; byName.set(t.song_name, entry) }
      entry.count++
      if (t.is_jamchart) entry.jc++
    }
    const list: SongOption[] = [...byName.entries()]
      .map(([name, v]) => ({
        song_name: name,
        times_played: v.count,
        jamchart_count: v.jc,
        jamchart_pct: v.count > 0 ? Math.round(1000 * v.jc / v.count) / 10 : 0,
      }))
      .sort((a, b) => b.jamchart_count - a.jamchart_count || b.times_played - a.times_played)

    setSongList(list)
    if (list.length > 0) {
      const urlSong = selectedSong
      const match = list.find(s => s.song_name === urlSong)
      if (match) {
        if (match.times_played < minPlayed) setMinPlayed(Math.max(1, match.times_played))
      } else if (!urlSong) {
        setSelectedSong(list[0].song_name)
      } else {
        setSelectedSong(list[0].song_name)
      }
    }
    setSongListLoaded(true)
  }, [allTracks, tour, weekday]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch history when selection or year changes, apply tour/weekday filters
  useEffect(() => {
    if (!selectedSong) return
    setData(null)
    dataSource.fetchSongHistory(selectedSong, year)
      .then((raw: SongHistory) => {
        setData({
          song_name: raw.song_name,
          tracks: filterTracksByTourDay(raw.tracks, tour, weekday),
        })
      })
      .catch(() => {})
  }, [selectedSong, year, tour, weekday])

  // D3 chart
  useEffect(() => {
    if (!svgRef.current || !data || data.tracks.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const tracks = data.tracks.filter(t => t.duration_ms > 0)
    if (tracks.length === 0) {
      svg.attr('width', chartWidth).attr('height', 100)
      svg.append('text').attr('x', chartWidth / 2).attr('y', 50)
        .attr('text-anchor', 'middle').style('fill', '#999').style('font-size', '14px')
        .text('No duration data available for this song')
      return
    }

    const margin = { top: 40, right: 30, bottom: 60, left: 50 }
    const width = chartWidth
    const height = 400

    svg.attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    const parseDate = d3.timeParse('%Y-%m-%d')
    const durations = tracks.map(t => t.duration_ms / 60000)

    const x = d3.scaleTime()
      .domain(d3.extent(tracks, t => parseDate(t.show_date)!) as [Date, Date])
      .range([margin.left, width - margin.right])

    const maxDur = d3.max(durations) ?? 30
    const y = d3.scaleLinear()
      .domain([0, Math.ceil(maxDur / 5) * 5 + 5])
      .range([height - margin.bottom, margin.top])

    const defs = svg.append('defs')

    // Grid lines
    svg.selectAll('.grid-line')
      .data(y.ticks(8))
      .join('line')
      .attr('x1', margin.left).attr('x2', width - margin.right)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', '#eee').attr('stroke-width', 0.5)

    // Area
    const areaGen = d3.area<Track>()
      .x(t => x(parseDate(t.show_date)!))
      .y0(height - margin.bottom)
      .y1(t => y(t.duration_ms / 60000))
      .curve(d3.curveMonotoneX)

    const areaGrad = defs.append('linearGradient')
      .attr('id', 'area-grad').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%')
    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.2)
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.02)

    svg.append('path').datum(tracks).attr('d', areaGen).attr('fill', 'url(#area-grad)')

    // Line
    const lineGen = d3.line<Track>()
      .x(t => x(parseDate(t.show_date)!))
      .y(t => y(t.duration_ms / 60000))
      .curve(d3.curveMonotoneX)

    svg.append('path').datum(tracks).attr('d', lineGen)
      .attr('fill', 'none').attr('stroke', '#ef4444').attr('stroke-width', 2).attr('stroke-linejoin', 'round')

    // Dots
    svg.selectAll('.track-dot')
      .data(tracks)
      .join('circle')
      .attr('class', 'track-dot')
      .attr('cx', t => x(parseDate(t.show_date)!))
      .attr('cy', t => y(t.duration_ms / 60000))
      .attr('r', t => t.is_jamchart ? 8 : 5)
      .attr('fill', t => {
        if (!t.jam_url) return '#fff'
        return t.is_jamchart ? '#ef4444' : '#e5e7eb'
      })
      .attr('stroke', t => t.is_jamchart ? '#b91c1c' : '#999')
      .attr('stroke-width', t => t.is_jamchart ? 2 : 1.5)
      .attr('stroke-dasharray', t => t.jam_url ? 'none' : '3,2')
      .style('cursor', 'pointer')

    // Jamchart stars
    const starPath = 'M0,-8 L2,-3 L7,-3 L3,1 L5,6 L0,3 L-5,6 L-3,1 L-7,-3 L-2,-3 Z'
    svg.selectAll('.jc-star')
      .data(tracks.filter(t => t.is_jamchart))
      .join('path')
      .attr('class', 'jc-star')
      .attr('d', starPath)
      .attr('transform', t => {
        const cx = x(parseDate(t.show_date)!)
        const cy = y(t.duration_ms / 60000) - 16
        return `translate(${cx},${cy}) scale(0.7)`
      })
      .attr('fill', '#ef4444').attr('opacity', 0.8)
      .style('pointer-events', 'none')

    // Hover targets
    svg.selectAll('.hover-target')
      .data(tracks)
      .join('rect')
      .attr('class', 'hover-target')
      .attr('x', t => x(parseDate(t.show_date)!) - 18)
      .attr('y', margin.top)
      .attr('width', 36)
      .attr('height', height - margin.top - margin.bottom)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent, t) => {
        if (!tooltipRef.current) return
        const tip = tooltipRef.current
        const dur = fmtDuration(t.duration_ms)
        const jcBadge = t.is_jamchart
          ? '<strong style="color:#ef4444">&#9733; JAMCHART</strong><br/>'
          : ''
        tip.innerHTML = `<strong>${esc(t.show_date)}</strong><br/>`
          + `${esc(t.venue)}<br/>`
          + `${esc(t.location)}<br/>`
          + `<br/>`
          + `${jcBadge}`
          + `Duration: <strong>${dur}</strong><br/>`
          + `Set: ${esc(t.set_name)}, Position ${t.position}<br/>`
          + `Likes: ${t.likes}<br/>`
          + (t.jam_notes
            ? `<br/><div style="border-top:1px solid #555;padding-top:6px;margin-top:4px;font-size:11px;color:#ccc;max-width:280px">${esc(t.jam_notes)}</div>`
            : '')
          + (t.jam_url
            ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #555;font-size:15px;font-weight:800;color:#22c55e;text-align:center;letter-spacing:0.5px">CLICK TO FIND JAM AND PLAY</div>`
            : `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #555;font-size:12px;color:#64748b;text-align:center">No audio available</div>`)
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })
      .on('click', (_event: MouseEvent, t) => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        setSidebarTrack(t)
      })

    // X axis
    const tickCount = Math.min(tracks.length, 20)
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(tickCount).tickFormat(d3.timeFormat('%b \'%y') as any))
      .selectAll('text')
      .style('font-size', '10px').style('fill', '#666')
      .attr('transform', 'rotate(-40)')
      .attr('text-anchor', 'end')

    // Y axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(8).tickFormat(d => `${d}m`))
      .selectAll('text')
      .style('font-size', '10px').style('fill', '#666')

    // Y axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(margin.top + height - margin.bottom) / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px').style('fill', '#888').style('font-weight', '600')
      .text('Duration (minutes)')

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 24)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px').style('fill', '#333').style('font-weight', '700')
      .text(data.song_name)

    svg.append('text')
      .attr('x', width / 2).attr('y', 42)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px').style('fill', '#999')
      .text(`${tracks.length} performances since ${tracks[0].show_date}`)

    // Legend
    const legendX = width - margin.right - 180
    const legendY = 18
    svg.append('circle').attr('cx', legendX).attr('cy', legendY).attr('r', 4).attr('fill', '#e5e7eb').attr('stroke', '#999')
    svg.append('text').attr('x', legendX + 10).attr('y', legendY + 4)
      .style('font-size', '10px').style('fill', '#888').text('Standard')
    svg.append('circle').attr('cx', legendX + 80).attr('cy', legendY).attr('r', 6).attr('fill', '#ef4444').attr('stroke', '#b91c1c')
    svg.append('path').attr('d', starPath)
      .attr('transform', `translate(${legendX + 80},${legendY - 14}) scale(0.5)`)
      .attr('fill', '#ef4444')
    svg.append('text').attr('x', legendX + 92).attr('y', legendY + 4)
      .style('font-size', '10px').style('fill', '#888').text('Jamchart')
    svg.append('circle').attr('cx', legendX + 148).attr('cy', legendY).attr('r', 4)
      .attr('fill', '#fff').attr('stroke', '#999').attr('stroke-dasharray', '3,2')
    svg.append('text').attr('x', legendX + 158).attr('y', legendY + 4)
      .style('font-size', '10px').style('fill', '#888').text('No audio')

    // Annotate longest
    const longest = tracks.reduce((a, b) => a.duration_ms > b.duration_ms ? a : b)
    const lx = x(parseDate(longest.show_date)!)
    const ly = y(longest.duration_ms / 60000)
    svg.append('line')
      .attr('x1', lx + 12).attr('y1', ly - 4)
      .attr('x2', lx + 40).attr('y2', ly - 20)
      .attr('stroke', '#ccc').attr('stroke-width', 1)
    svg.append('text')
      .attr('x', lx + 42).attr('y', ly - 22)
      .style('font-size', '10px').style('fill', '#555').style('font-weight', '600')
      .text(`${fmtDuration(longest.duration_ms)} peak`)

    // Stats bar
    const statsY = height - 18
    const avgDur = d3.mean(tracks, t => t.duration_ms / 60000) ?? 0
    const jcCount = tracks.filter(t => t.is_jamchart).length
    const jcPct = tracks.length > 0 ? Math.round(100 * jcCount / tracks.length) : 0
    const totalLikes = d3.sum(tracks, t => t.likes)

    svg.append('text')
      .attr('x', width / 2).attr('y', statsY)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px').style('fill', '#999')
      .text([
        `Avg: ${avgDur.toFixed(1)}m`,
        `Longest: ${fmtDuration(longest.duration_ms)}`,
        `Jamcharts: ${jcCount}/${tracks.length} (${jcPct}%)`,
        `Total likes: ${totalLikes}`,
      ].join('    '))

  }, [data, viewMode, chartWidth])

  function battingAvg(s: SongOption): number {
    return s.times_played > 0 ? s.jamchart_count / s.times_played : 0
  }

  function fmtAvg(s: SongOption): string {
    if (s.times_played === 0) return '.000'
    const avg = s.jamchart_count / s.times_played
    return avg >= 1 ? '1.000' : ('.' + Math.round(avg * 1000).toString().padStart(3, '0'))
  }

  const filtered = songList
    .filter(s => s.times_played >= minPlayed || s.song_name === selectedSong)
    .filter(s => !filter || s.song_name.toLowerCase().includes(filter.toLowerCase()) || s.song_name === selectedSong)

  const sortedSongs = [...filtered].sort((a, b) => {
    if (sortBy === 'avg') return battingAvg(b) - battingAvg(a) || b.jamchart_count - a.jamchart_count
    if (sortBy === 'jc') return b.jamchart_count - a.jamchart_count || battingAvg(b) - battingAvg(a)
    return b.times_played - a.times_played
  })

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        Duration timeline {year === 'all' ? 'for any Phish 3.0 song' : `for ${year}`}. Larger red dots with stars = jamchart selections. Hover for details, click for more.
      </p>
      <div data-tour="deep-dive-controls" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setViewMode(viewMode === 'chart' ? 'card' : 'chart')}
          style={{
            padding: '0.5rem 1.2rem', fontSize: '0.95rem',
            background: viewMode === 'card' ? '#1a1a2e' : 'none',
            border: viewMode === 'card' ? '2px solid #ef4444' : '2px solid #ccc',
            borderRadius: '8px',
            color: viewMode === 'card' ? '#ef4444' : '#444',
            cursor: 'pointer', fontWeight: 700,
          }}
        >
          {viewMode === 'chart' ? 'Baseball Card View' : 'Chart View'}
        </button>
        <label style={{ fontSize: '0.85rem' }}>
          Song:
          <input
            type="text"
            placeholder="Filter songs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: 160 }}
          />
        </label>
        <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          Min played:
          <input
            type="range"
            min={1}
            max={Math.max(20, Math.round((songList[0]?.times_played ?? 20) / 2))}
            value={minPlayed}
            onChange={e => setMinPlayed(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <span style={{ minWidth: 20, textAlign: 'center' }}>{minPlayed}</span>
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          Tour:
          <select
            value={tour}
            onChange={e => setTour(e.target.value as TourFilter)}
            style={{ marginLeft: '0.5rem', padding: '0.3rem', fontSize: '0.85rem' }}
          >
            <option value="all">All</option>
            <option value="Winter">Winter</option>
            <option value="Spring">Spring</option>
            <option value="Summer">Summer</option>
            <option value="Fall">Fall</option>
            <option value="Holiday">Holiday</option>
          </select>
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          Day:
          <select
            value={weekday}
            onChange={e => setWeekday(e.target.value as WeekdayFilter)}
            style={{ marginLeft: '0.5rem', padding: '0.3rem', fontSize: '0.85rem' }}
          >
            <option value="all">All</option>
            <option value="Sunday">Sun</option>
            <option value="Monday">Mon</option>
            <option value="Tuesday">Tue</option>
            <option value="Wednesday">Wed</option>
            <option value="Thursday">Thu</option>
            <option value="Friday">Fri</option>
            <option value="Saturday">Sat</option>
          </select>
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          Sort:
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'avg' | 'jc' | 'played')}
            style={{ marginLeft: '0.5rem', padding: '0.3rem', fontSize: '0.85rem' }}
          >
            <option value="avg">Batting Avg</option>
            <option value="jc">Jamchart Count</option>
            <option value="played">Times Played</option>
          </select>
        </label>
        <select
          value={selectedSong}
          onChange={e => { setSelectedSong(e.target.value); setFilter('') }}
          style={{ padding: '0.3rem', fontSize: '0.85rem', maxWidth: 420 }}
        >
          {sortedSongs.map(s => (
            <option key={s.song_name} value={s.song_name}>
              {s.song_name} ({fmtAvg(s)} avg, {s.jamchart_count} JC, {s.times_played}x)
            </option>
          ))}
        </select>
        {data === null && selectedSong && <span style={{ color: '#999', fontSize: '0.8rem' }}>Loading...</span>}
      </div>
      {viewMode === 'chart' ? (
        <div ref={chartContainerRef} data-tour="deep-dive-chart" style={{ display: 'flex', gap: '16px', minHeight: 420 }}>
          {/* Chart area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <svg ref={svgRef} style={{ width: '100%' }} />
            {!sidebarTrack && data && data.tracks.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: '8px', color: '#888', fontSize: '13px' }}>
                Click any dot to see jam details
              </div>
            )}
          </div>
          {/* Sidebar */}
          {sidebarTrack && (
            <div style={{
              width: '320px', flexShrink: 0,
              background: '#fff', borderRadius: '8px',
              border: '1px solid #e5e7eb', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
              {/* Header */}
              <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#111' }}>{sidebarTrack.show_date}</div>
                    <div style={{ color: '#555', fontSize: '14px', marginTop: '4px' }}>{sidebarTrack.venue}</div>
                    <div style={{ color: '#888', fontSize: '13px' }}>{sidebarTrack.location}</div>
                  </div>
                  <button
                    onClick={() => setSidebarTrack(null)}
                    style={{
                      background: '#f3f4f6', border: 'none', color: '#666',
                      cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: '4px',
                    }}
                  >&times;</button>
                </div>
              </div>
              {/* Stats */}
              <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                {sidebarTrack.is_jamchart && (
                  <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '18px' }}>&#9733;</span> JAMCHART
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Duration</span>
                  <span style={{ color: '#111', fontWeight: 700, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(sidebarTrack.duration_ms)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Set / Position</span>
                  <span style={{ color: '#333', fontSize: '14px' }}>{sidebarTrack.set_name} #{sidebarTrack.position}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888', fontSize: '13px' }}>Likes</span>
                  <span style={{ color: '#333', fontSize: '14px' }}>{sidebarTrack.likes}</span>
                </div>
              </div>
              {/* Notes */}
              {sidebarTrack.jam_notes && (
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', flex: 1, overflow: 'auto' }}>
                  <div style={{ color: '#888', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase' }}>Jam Notes</div>
                  <div style={{ color: '#555', fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic' }}>
                    {sidebarTrack.jam_notes}
                  </div>
                </div>
              )}
              {/* Actions */}
              <div style={{ padding: '16px', marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    onClick={shareSidebarTrack}
                    style={{
                      flex: 1, padding: '10px', background: sidebarShareToast ? '#22c55e' : '#3b82f6',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}
                  >
                    {sidebarShareToast ? '\u2713 Copied!' : '\u21AA Share'}
                  </button>
                </div>
                {sidebarTrack.jam_url ? (
                  <button
                    onClick={() => playJam(sidebarTrack.jam_url, sidebarTrack.show_date, sidebarTrack.song_name)}
                    style={{
                      width: '100%', padding: '14px', background: '#22c55e', color: 'white',
                      border: 'none', borderRadius: '10px', cursor: 'pointer',
                      fontSize: '16px', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>&#9654;</span>
                    Play Jam
                  </button>
                ) : (
                  <div style={{
                    width: '100%', padding: '12px', background: '#f3f4f6',
                    borderRadius: '10px', textAlign: 'center',
                    fontSize: '13px', color: '#6b7280',
                  }}>
                    No audio available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <CardGrid
          songs={sortedSongs}
          year={year}
          tour={tour}
          weekday={weekday}
          playJam={playJam}
          nowPlaying={nowPlaying}
          highlightSong={highlightJam ? selectedSong : null}
          highlightDate={highlightJam}
        />
      )}
      {/* Hover tooltip — info only */}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 300,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
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
      {nowPlaying && (() => {
        const fmtSec = (s: number) => {
          if (!s || !isFinite(s)) return '0:00'
          const m = Math.floor(s / 60)
          const sec = Math.floor(s % 60)
          return `${m}:${String(sec).padStart(2, '0')}`
        }
        const pct = playbackTime.duration > 0 ? (playbackTime.current / playbackTime.duration) * 100 : 0
        return (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#1a1a2e', color: 'white',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.4)', zIndex: 1001,
          }}>
            {/* Progress bar */}
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
              padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: '16px',
              fontSize: '15px',
            }}>
              <button
                onClick={stopPlayback}
                style={{
                  background: 'none', border: 'none', color: '#ef4444',
                  cursor: 'pointer', fontSize: '24px', padding: '0 4px', lineHeight: 1,
                }}
                title="Stop"
              >&#9632;</button>
              <span style={{ color: '#22c55e', fontSize: '20px' }}>&#9654;</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>
                  <strong style={{ fontSize: '16px' }}>{nowPlaying.song}</strong>
                  {' '}
                  <span style={{ color: '#94a3b8' }}>{nowPlaying.date}</span>
                </span>
                <span style={{ fontSize: '13px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtSec(playbackTime.current)} / {fmtSec(playbackTime.duration)}
                </span>
              </div>
              <button
                onClick={shareNowPlaying}
                title="Share this jam"
                style={{
                  marginLeft: 'auto',
                  background: playbarShareToast ? '#22c55e' : '#334155',
                  color: 'white', border: 'none', borderRadius: '6px',
                  padding: '8px 14px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'background 0.2s',
                }}
              >
                {playbarShareToast ? '\u2713 Copied!' : '\u21AA Share'}
              </button>
              <span style={{ color: '#475569', fontSize: '12px' }}>
                via PhishJustJams
              </span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
