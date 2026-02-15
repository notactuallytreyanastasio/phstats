import { useRef, useEffect, useState, useCallback } from 'react'
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

type ListFilter = 'all' | 'jamcharts' | 'has-clip'

export default function SongDeepDiveMobile({ year }: { year: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [songList, setSongList] = useState<SongOption[]>([])
  const [selectedSong, setSelectedSong] = useState(() => getParam('song') || '')
  const [songListLoaded, setSongListLoaded] = useState(false)
  const [data, setData] = useState<SongHistory | null>(null)
  const [nowPlaying, setNowPlaying] = useState<{ url: string; date: string; song: string } | null>(null)
  const [playbackTime, setPlaybackTime] = useState({ current: 0, duration: 0 })
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
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
  }, [])

  // Sync state to URL params
  useEffect(() => {
    if (!songListLoaded) return
    setParams({
      song: selectedSong || null,
      sort: sortBy === 'avg' ? null : sortBy,
      min: minPlayed === 5 ? null : String(minPlayed),
    })
  }, [selectedSong, sortBy, minPlayed, songListLoaded])

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
    dataSource.fetchSongHistory(selectedSong, year)
      .then(setData)
      .catch(() => {})
  }, [selectedSong, year])

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
    if (listFilter === 'has-clip') return !!t.jam_url
    return true
  })
  const jcCount = tracks.filter(t => t.is_jamchart).length
  const clipCount = tracks.filter(t => t.jam_url).length
  const avgDur = tracks.length > 0
    ? tracks.reduce((sum, t) => sum + t.duration_ms, 0) / tracks.length
    : 0
  const longestMs = tracks.length > 0
    ? Math.max(...tracks.map(t => t.duration_ms))
    : 0

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
      {/* Sticky song picker */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', padding: '8px 12px',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <select
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
              {s.song_name} ({fmtAvg(s)} · {s.jamchart_count} JC · {s.times_played}×)
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
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
          <span style={{ fontSize: '12px', color: '#999', marginLeft: 'auto' }}>
            Min {minPlayed}×
          </span>
          <input
            type="range" min={1} max={20} value={minPlayed}
            onChange={e => setMinPlayed(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>
      </div>

      {/* Baseball card - song stats hero */}
      {currentSongOption && data && (
        <div style={{
          margin: '12px', padding: '20px', borderRadius: '16px',
          background: '#1a1a2e', color: 'white',
          border: '2px solid #334155',
          textAlign: 'center',
        }}>
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
          </div>
        </div>
      )}

      {/* Loading state */}
      {!data && selectedSong && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading...</div>
      )}

      {/* Filter pills */}
      {data && tracks.length > 0 && (
        <div style={{
          display: 'flex', gap: '8px', padding: '0 12px 12px',
          overflowX: 'auto',
        }}>
          {pill('All', 'all', tracks.length)}
          {pill('Jamcharts', 'jamcharts', jcCount)}
          {pill('Has Clip', 'has-clip', clipCount)}
        </div>
      )}

      {/* Performance cards */}
      <div style={{ padding: '0 12px' }}>
        {filteredTracks.map((t, i) => {
          const isJc = !!t.is_jamchart
          const hasClip = !!t.jam_url
          const isExpanded = expandedIdx === i
          return (
            <div
              key={`${t.show_date}-${t.set_name}-${t.position}`}
              style={{
                marginBottom: '10px',
                borderRadius: '12px',
                background: '#fafafa',
                border: '1px solid #e5e7eb',
                borderLeft: isJc ? '4px solid #ef4444' : '4px solid #d1d5db',
                overflow: 'hidden',
              }}
            >
              {/* Card header */}
              <div
                onClick={() => t.jam_notes ? setExpandedIdx(isExpanded ? null : i) : undefined}
                style={{ padding: '12px 14px', cursor: t.jam_notes ? 'pointer' : 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isJc && <span style={{ color: '#ef4444', fontSize: '14px' }}>&#9733;</span>}
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#111' }}>{t.show_date}</span>
                  </div>
                  <span style={{
                    fontSize: '18px', fontWeight: 800, color: isJc ? '#ef4444' : '#374151',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmtDuration(t.duration_ms)}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>{t.venue}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>{t.location}</div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                  Set {t.set_name} #{t.position} · {t.likes} likes
                </div>

                {/* Jam notes */}
                {t.jam_notes && (
                  <div style={{
                    marginTop: '8px', paddingTop: '8px',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '12px', color: '#666', lineHeight: '1.5',
                    fontStyle: 'italic',
                    ...(!isExpanded ? {
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

              {/* Play button */}
              {hasClip && (
                <button
                  onClick={() => playJam(t.jam_url, t.show_date, t.song_name)}
                  style={{
                    width: '100%', padding: '12px',
                    background: nowPlaying?.url === t.jam_url ? '#16a34a' : '#22c55e',
                    color: 'white', border: 'none',
                    fontSize: '15px', fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    borderTop: '1px solid rgba(0,0,0,0.1)',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>
                    {nowPlaying?.url === t.jam_url ? '\u23F8' : '\u25B6'}
                  </span>
                  {nowPlaying?.url === t.jam_url ? 'PLAYING' : 'PLAY JAM'}
                </button>
              )}
            </div>
          )
        })}

        {filteredTracks.length === 0 && data && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontSize: '14px' }}>
            No performances match this filter
          </div>
        )}
      </div>

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
