import { useRef, useEffect, useState, useCallback } from 'react'
import Joyride, { STATUS } from 'react-joyride'
import type { CallBackProps, Step } from 'react-joyride'
import * as d3 from 'd3'
import * as dataSource from '../api/data-source'
import { getParam, setParams } from '../url-params'
import { tourFromDate, weekdayFromDate } from '../../core/phangraphs/date-utils'

const TOUR_KEY = 'phstats-tour-seen-v2'
// Capture if user arrived with query params (before we push any)
const hadInitialParams = (() => {
  const params = new URLSearchParams(window.location.search)
  // Only count as "shared link" if there's a song or jam param
  return params.has('song') || params.has('jam')
})()

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

type ViewMode = 'browse' | 'chart' | 'card'

// Vintage baseball card palette - cream, gold, black
const COLORS = {
  cardBg: '#f5f0e1',        // cream
  cardBorder: '#c9a227',    // gold
  cardBorderMuted: '#d4c4a1', // muted gold/tan
  headerBg: '#1a1a1a',      // black
  headerBgJc: '#b91c1c',    // deep red for jamcharts
  statsBg: '#2d2d2d',       // dark gray
  notesBg: '#1a1a1a',       // black
  textLight: '#fff',
  textMuted: '#d4c4a1',     // tan
  gold: '#c9a227',          // gold accent
  accent: '#c9a227',        // gold
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

function filterTracksByTourDay(tracks: Track[], tour: TourFilter, weekday: WeekdayFilter): Track[] {
  let result = tracks
  if (tour !== 'all') result = result.filter(t => tourFromDate(t.show_date) === tour)
  if (weekday !== 'all') result = result.filter(t => weekdayFromDate(t.show_date) === weekday)
  return result
}

function JamCardGrid({
  songName,
  tracks,
  playJam,
  nowPlaying,
}: {
  songName: string
  tracks: Track[]
  playJam: (url: string, date: string, song: string) => void
  nowPlaying: { url: string; date: string; song: string } | null
}) {
  const [shareToast, setShareToast] = useState<string | null>(null)

  const shareJam = (date: string) => {
    const url = buildShareUrl(songName, date, 'card')
    copyToClipboard(url).then(() => {
      setShareToast(date)
      setTimeout(() => setShareToast(null), 2000)
    })
  }

  if (tracks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
        No jams found for this song with current filters.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '16px',
    }}>
      {tracks.map((t) => {
        const isPlaying = nowPlaying?.date === t.show_date && nowPlaying?.song === songName
        const isJc = !!t.is_jamchart
        const isShared = shareToast === t.show_date

        return (
          <div
            key={`${t.show_date}-${t.set_name}-${t.position}`}
            style={{
              background: COLORS.cardBg,
              border: `2px solid ${isJc ? COLORS.headerBgJc : COLORS.cardBorder}`,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: isPlaying ? '0 0 0 4px rgba(34, 197, 94, 0.4)' : '0 4px 16px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              background: isJc ? COLORS.headerBgJc : COLORS.headerBg,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                    {isJc && <span style={{ color: COLORS.gold, marginRight: '6px' }}>&#9733;</span>}
                    {t.show_date}
                  </div>
                  <div style={{ color: COLORS.textLight, fontSize: '13px', marginTop: '4px' }}>{t.venue}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: '12px' }}>{t.location}</div>
                </div>
                <div style={{
                  fontSize: '24px', fontWeight: 900, color: isJc ? COLORS.gold : '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fmtDuration(t.duration_ms)}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'flex', gap: '16px', padding: '10px 16px',
              fontSize: '12px', color: '#fff', fontWeight: 600,
              background: COLORS.statsBg,
            }}>
              <span>Set: {t.set_name}</span>
              <span>Position: #{t.position}</span>
              <span>Likes: {t.likes}</span>
            </div>

            {/* Notes */}
            {t.jam_notes && (
              <div style={{
                background: COLORS.notesBg,
                margin: '12px',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                color: COLORS.textLight,
                lineHeight: '1.6',
                fontStyle: 'italic',
              }}>
                {t.jam_notes}
              </div>
            )}

            {/* Actions - pinned to bottom */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px', background: COLORS.cardBg, marginTop: 'auto' }}>
              {t.jam_url ? (
                <button
                  onClick={() => playJam(t.jam_url, t.show_date, songName)}
                  style={{
                    flex: 1, padding: '12px', background: isPlaying ? '#16a34a' : COLORS.headerBg,
                    color: '#fff', border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <span>&#9654;</span> {isPlaying ? 'Playing...' : 'Play Jam'}
                </button>
              ) : (
                <div style={{
                  flex: 1, padding: '12px', background: '#e2e8f0',
                  borderRadius: '8px', textAlign: 'center',
                  fontSize: '13px', color: '#64748b', fontWeight: 600,
                }}>
                  No audio
                </div>
              )}
              {t.jam_url && (
                <button
                  onClick={() => shareJam(t.show_date)}
                  style={{
                    padding: '12px 16px', background: isShared ? '#22c55e' : COLORS.accent,
                    color: '#fff', border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {isShared ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const CARD_HEIGHT = 380

function SongBrowseGrid({
  songs,
  year,
  onSelectSong,
  fmtAvg,
  playJam,
  nowPlaying,
  tourStep,
}: {
  songs: SongOption[]
  year: string
  onSelectSong: (name: string) => void
  fmtAvg: (s: SongOption) => string
  playJam: (url: string, date: string, song: string) => void
  nowPlaying: { url: string; date: string; song: string } | null
  tourStep?: number
}) {
  const [flippedCard, setFlippedCard] = useState<string | null>(null)
  const [cardData, setCardData] = useState<Record<string, SongHistory>>({})

  // Flip first card when tour reaches step 3 (card back step)
  useEffect(() => {
    if (tourStep === 3 && songs.length > 0 && flippedCard !== songs[0].song_name) {
      setFlippedCard(songs[0].song_name)
    } else if (tourStep !== undefined && tourStep < 3 && flippedCard) {
      setFlippedCard(null)
    }
  }, [tourStep, songs, flippedCard])

  // Fetch data when a card is flipped
  useEffect(() => {
    if (flippedCard && !cardData[flippedCard]) {
      dataSource.fetchSongHistory(flippedCard, year)
        .then(data => setCardData(prev => ({ ...prev, [flippedCard]: data })))
        .catch(() => {})
    }
  }, [flippedCard, year, cardData])

  const handleCardClick = (songName: string) => {
    if (flippedCard === songName) {
      // Already flipped, go to detail view
      onSelectSong(songName)
    } else {
      // Flip the card
      setFlippedCard(songName)
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '16px',
    }}>
      {songs.map((s, i) => {
        const avg = s.times_played > 0 ? s.jamchart_count / s.times_played : 0
        const isHot = avg >= 0.3
        const isWarm = avg >= 0.15 && avg < 0.3
        const isFlipped = flippedCard === s.song_name
        const history = cardData[s.song_name]

        return (
          <div key={s.song_name} data-tour={i === 0 ? 'browse-card' : undefined} style={{ perspective: '1000px', height: CARD_HEIGHT }}>
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s ease',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              {/* FRONT */}
              <div
                onClick={() => handleCardClick(s.song_name)}
                style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  background: COLORS.cardBg,
                  border: `3px solid ${isHot ? COLORS.headerBgJc : isWarm ? COLORS.gold : COLORS.cardBorder}`,
                  borderRadius: '8px',
                  padding: '20px',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                {/* Rank badge */}
                <div style={{
                  position: 'absolute', top: '-10px', left: '-10px',
                  background: isHot ? COLORS.headerBgJc : isWarm ? COLORS.gold : COLORS.accent,
                  color: '#fff', width: '28px', height: '28px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 800, boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}>
                  {i + 1}
                </div>

                {/* Batting average */}
                <div style={{
                  fontSize: '52px', fontWeight: 900,
                  color: isHot ? COLORS.headerBgJc : isWarm ? COLORS.gold : COLORS.headerBg,
                  fontFamily: 'monospace',
                  letterSpacing: '-2px',
                  marginBottom: '12px',
                }}>
                  {fmtAvg(s)}
                </div>

                {/* Song name */}
                <div style={{
                  fontSize: '22px', fontWeight: 800, color: COLORS.headerBg,
                  marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px',
                  lineHeight: 1.2,
                }}>
                  {s.song_name}
                </div>

                {/* Stats */}
                <div style={{ fontSize: '18px', color: '#5a4a32', marginBottom: '20px' }}>
                  <span style={{ color: COLORS.headerBgJc, fontWeight: 800, fontSize: '22px' }}>{s.jamchart_count}</span>
                  <span style={{ color: '#7a6a52' }}> jamcharts</span>
                  <span style={{ color: '#9a8a72' }}> / </span>
                  <span style={{ fontWeight: 700 }}>{s.times_played}</span>
                  <span style={{ color: '#7a6a52' }}> played</span>
                </div>

                <div style={{ fontSize: '12px', color: COLORS.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Click to flip
                </div>
              </div>

              {/* BACK */}
              <div
                onClick={() => setFlippedCard(null)}
                style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: COLORS.cardBg,
                  border: `3px solid ${COLORS.gold}`,
                  borderRadius: '8px',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div style={{
                  background: COLORS.headerBg, padding: '10px 14px',
                  borderBottom: `2px solid ${COLORS.gold}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: '14px' }}>{s.song_name}</div>
                  <div style={{ color: COLORS.gold, fontWeight: 800, fontSize: '16px', fontFamily: 'monospace' }}>{fmtAvg(s)}</div>
                </div>

                {/* Jam list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {!history ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6b5b3d' }}>Loading...</div>
                  ) : history.tracks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6b5b3d' }}>No jams found</div>
                  ) : (
                    history.tracks.slice(0, 15).map((t, idx) => {
                      const isJc = !!t.is_jamchart
                      const isPlaying = nowPlaying?.url === t.jam_url
                      return (
                        <div
                          key={`${t.show_date}-${t.position}`}
                          data-tour={i === 0 && idx === 0 ? 'jam-item' : undefined}
                          style={{
                            padding: '6px 8px', marginBottom: '4px',
                            background: isPlaying ? '#d4edda' : isJc ? '#fff5f5' : '#fff',
                            border: `1px solid ${isJc ? COLORS.headerBgJc : '#ddd'}`,
                            borderRadius: '4px',
                            borderLeft: isJc ? `3px solid ${COLORS.headerBgJc}` : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                            <span style={{ fontWeight: 700, color: COLORS.headerBg }}>
                              {isJc && <span style={{ color: COLORS.headerBgJc }}>★ </span>}
                              {t.show_date}
                            </span>
                            <span style={{ color: isJc ? COLORS.headerBgJc : '#666', fontWeight: 700 }}>
                              {fmtDuration(t.duration_ms)}
                            </span>
                          </div>
                          <div style={{ fontSize: '9px', color: '#888', marginTop: '1px', marginBottom: '4px' }}>{t.venue}</div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {t.jam_url ? (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); playJam(t.jam_url, t.show_date, s.song_name) }}
                                  style={{
                                    flex: 1, padding: '4px 6px', fontSize: '10px', fontWeight: 700,
                                    background: isPlaying ? '#16a34a' : COLORS.headerBg, color: '#fff',
                                    border: 'none', borderRadius: '3px', cursor: 'pointer',
                                  }}
                                >
                                  {isPlaying ? '▶ Playing' : '▶ Play'}
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    const url = buildShareUrl(s.song_name, t.show_date, 'card')
                                    copyToClipboard(url)
                                  }}
                                  style={{
                                    padding: '4px 8px', fontSize: '10px', fontWeight: 700,
                                    background: COLORS.gold, color: '#fff',
                                    border: 'none', borderRadius: '3px', cursor: 'pointer',
                                  }}
                                >
                                  Share
                                </button>
                              </>
                            ) : (
                              <div style={{ fontSize: '9px', color: '#999', fontStyle: 'italic' }}>No audio</div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Footer */}
                <div
                  data-tour={i === 0 ? 'card-footer' : undefined}
                  style={{
                  padding: '10px', borderTop: `2px solid ${COLORS.gold}`,
                  display: 'flex', gap: '8px',
                }}>
                  <button
                    onClick={e => { e.stopPropagation(); onSelectSong(s.song_name) }}
                    style={{
                      flex: 1, padding: '8px', background: COLORS.headerBg, color: COLORS.gold,
                      border: `2px solid ${COLORS.gold}`, borderRadius: '4px',
                      fontWeight: 700, cursor: 'pointer', fontSize: '12px',
                    }}
                  >
                    View All Jams →
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setFlippedCard(null) }}
                    style={{
                      padding: '8px 12px', background: COLORS.cardBg, color: COLORS.headerBg,
                      border: `2px solid ${COLORS.gold}`, borderRadius: '4px',
                      fontWeight: 600, cursor: 'pointer', fontSize: '12px',
                    }}
                  >
                    Flip
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
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
    if (v === 'card' || v === 'chart') return v
    // Default to browse mode if no song specified
    if (!getParam('song')) return 'browse'
    return 'card'
  })

  const shareNowPlaying = useCallback(() => {
    if (!nowPlaying) return
    const shareView = viewMode === 'browse' ? 'card' : viewMode
    const url = buildShareUrl(nowPlaying.song, nowPlaying.date, shareView)
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
  const [runTour, setRunTour] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  // Start tour for first-time visitors (after songs load)
  useEffect(() => {
    if (!songListLoaded || songList.length === 0) return
    if (localStorage.getItem(TOUR_KEY)) return
    if (hadInitialParams) return // Don't show tour if coming from a shared link
    const t = setTimeout(() => setRunTour(true), 800)
    return () => clearTimeout(t)
  }, [songListLoaded, songList.length])

  const tourSteps: Step[] = [
    {
      target: '[data-tour="year-picker"]',
      title: 'Random Year Selection',
      content: 'Each visit starts with a random year from Phish 3.0 (2009–present). Use this dropdown to explore different years or view all time stats.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="song-search"]',
      title: 'Search for Songs',
      content: 'Type to search for any song. Results show batting average — the ratio of jamchart entries to times played.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="browse-card"]',
      title: 'Click to Flip',
      content: 'Each card shows a song\'s batting average. Click to flip it over and see the jam list!',
      placement: 'right',
    },
    {
      target: '[data-tour="jam-item"]',
      title: 'Play Any Jam',
      content: 'Click any jam to play it. Jamchart entries are highlighted with a red border and star. The duration shows how long the jam is.',
      placement: 'right',
    },
    {
      target: '[data-tour="card-footer"]',
      title: 'Dive Deeper',
      content: 'Click "View All Jams" for the full analysis with charts, or flip back to browse more songs.',
      placement: 'top',
    },
    {
      target: '[data-tour="filters"]',
      title: 'Filter Your View',
      content: 'Sort by batting average, jamchart count, or times played. Filter by minimum plays, tour season, or day of week.',
      placement: 'bottom-start',
    },
  ]

  function handleTourCallback(data: CallBackProps) {
    if (data.action === 'next' || data.action === 'prev') {
      setTourStep(data.index)
    }
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRunTour(false)
      setTourStep(0)
      localStorage.setItem(TOUR_KEY, 'true')
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
      } else if (urlSong && !match) {
        // Invalid song in URL, clear it
        setSelectedSong('')
      }
      // If no URL song, stay in browse mode (don't auto-select)
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

  const handleSelectSong = (name: string) => {
    setSelectedSong(name)
    setViewMode('card')
    setFilter('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        scrollToFirstStep
        callback={handleTourCallback}
        styles={{
          options: {
            primaryColor: COLORS.gold,
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: 8,
          },
          buttonNext: {
            backgroundColor: COLORS.gold,
          },
          buttonBack: {
            color: COLORS.headerBg,
          },
        }}
      />
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        {viewMode === 'browse' ? (
          <>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: '#1e293b' }}>
              Song Batting Averages {year === 'all' ? '(All Years)' : `(${year})`}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1rem' }}>
              Click any song to see its jam cards. Batting avg = jamcharts / times played.
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <button
              onClick={() => { setSelectedSong(''); setViewMode('browse') }}
              style={{
                padding: '0.4rem 0.8rem', fontSize: '0.85rem',
                background: 'none', border: `1px solid ${COLORS.gold}`,
                borderRadius: '6px', color: '#64748b', cursor: 'pointer',
              }}
            >
              ← All Songs
            </button>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {selectedSong}
              {(() => {
                const songStats = songList.find(s => s.song_name === selectedSong)
                if (!songStats) return null
                const avg = songStats.times_played > 0 ? songStats.jamchart_count / songStats.times_played : 0
                const isHot = avg >= 0.3
                const isWarm = avg >= 0.15
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: isHot ? COLORS.headerBgJc : isWarm ? COLORS.gold : COLORS.headerBg,
                    color: '#fff', fontSize: '16px', fontWeight: 900, fontFamily: 'monospace',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    {fmtAvg(songStats)}
                  </span>
                )
              })()}
            </h2>
          </div>
        )}
      </div>

      {/* Controls */}
      <div data-tour="deep-dive-controls" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {viewMode !== 'browse' && (
          <button
            onClick={() => setViewMode(viewMode === 'chart' ? 'card' : 'chart')}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.9rem',
              background: viewMode === 'card' ? COLORS.headerBg : COLORS.cardBg,
              border: `2px solid ${COLORS.gold}`,
              borderRadius: '4px',
              color: viewMode === 'card' ? '#fff' : COLORS.headerBg,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            {viewMode === 'chart' ? 'Card View' : 'Chart View'}
          </button>
        )}
        <div data-tour="song-search" style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search songs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem', fontSize: '0.9rem', width: 200,
              border: `2px solid ${COLORS.gold}`, borderRadius: '4px',
              background: COLORS.cardBg,
            }}
          />
          {filter && sortedSongs.length > 0 && viewMode === 'browse' && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: COLORS.cardBg, border: `2px solid ${COLORS.gold}`, borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, maxHeight: 200, overflow: 'auto',
            }}>
              {sortedSongs.slice(0, 8).map(s => (
                <div
                  key={s.song_name}
                  onClick={() => handleSelectSong(s.song_name)}
                  style={{
                    padding: '0.5rem 0.75rem', cursor: 'pointer',
                    borderBottom: `1px solid ${COLORS.cardBorderMuted}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ebe5d5'}
                  onMouseLeave={e => e.currentTarget.style.background = COLORS.cardBg}
                >
                  <span style={{ fontWeight: 600, color: COLORS.headerBg }}>{s.song_name}</span>
                  <span style={{ color: '#6b5b3d', marginLeft: '8px', fontSize: '0.85rem' }}>
                    {fmtAvg(s)} avg
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div data-tour="filters" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
            Sort:
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'avg' | 'jc' | 'played')}
              style={{ marginLeft: '0.5rem', padding: '0.4rem', fontSize: '0.85rem', borderRadius: '6px', border: `1px solid ${COLORS.gold}` }}
            >
              <option value="avg">Batting Avg</option>
              <option value="jc">Jamchart Count</option>
              <option value="played">Times Played</option>
            </select>
          </label>
          <label style={{ fontSize: '0.85rem' }}>
            Tour:
            <select
              value={tour}
              onChange={e => setTour(e.target.value as TourFilter)}
              style={{ marginLeft: '0.5rem', padding: '0.4rem', fontSize: '0.85rem', borderRadius: '6px', border: `1px solid ${COLORS.gold}` }}
            >
              <option value="all">All</option>
              <option value="Summer">Summer</option>
              <option value="Fall">Fall</option>
              <option value="Winter">Winter</option>
              <option value="Spring">Spring</option>
              <option value="Holiday">Holiday</option>
            </select>
          </label>
          <label style={{ fontSize: '0.85rem' }}>
            Day:
            <select
              value={weekday}
              onChange={e => setWeekday(e.target.value as WeekdayFilter)}
              style={{ marginLeft: '0.5rem', padding: '0.4rem', fontSize: '0.85rem', borderRadius: '6px', border: `1px solid ${COLORS.gold}` }}
            >
              <option value="all">All</option>
              <option value="Friday">Fri</option>
              <option value="Saturday">Sat</option>
              <option value="Sunday">Sun</option>
              <option value="Monday">Mon</option>
              <option value="Tuesday">Tue</option>
              <option value="Wednesday">Wed</option>
              <option value="Thursday">Thu</option>
            </select>
          </label>
        </div>
        {viewMode !== 'browse' && (
          <select
            value={selectedSong}
            onChange={e => handleSelectSong(e.target.value)}
            style={{ padding: '0.4rem', fontSize: '0.85rem', maxWidth: 300, borderRadius: '6px', border: `1px solid ${COLORS.gold}` }}
          >
            {sortedSongs.map(s => (
              <option key={s.song_name} value={s.song_name}>
                {s.song_name} ({fmtAvg(s)})
              </option>
            ))}
          </select>
        )}
        {data === null && selectedSong && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading...</span>}
      </div>

      {/* Main content */}
      {viewMode === 'browse' ? (
        <SongBrowseGrid songs={sortedSongs} year={year} onSelectSong={handleSelectSong} fmtAvg={fmtAvg} playJam={playJam} nowPlaying={nowPlaying} tourStep={runTour ? tourStep : undefined} />
      ) : viewMode === 'chart' ? (
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
                    {sidebarShareToast ? '\u2713 Copied!' : 'Copy Link'}
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
      ) : data && data.tracks.length > 0 ? (
        <JamCardGrid
          songName={selectedSong}
          tracks={data.tracks}
          playJam={playJam}
          nowPlaying={nowPlaying}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          {data === null ? 'Loading jams...' : 'No jams found for this song.'}
        </div>
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
                {playbarShareToast ? '\u2713 Copied!' : 'Copy Link'}
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
