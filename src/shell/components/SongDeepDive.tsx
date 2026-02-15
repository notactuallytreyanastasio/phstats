import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '?'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SongDeepDive({ year }: { year: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [songList, setSongList] = useState<SongOption[]>([])
  const [selectedSong, setSelectedSong] = useState(() => getParam('song') || '')
  const [songListLoaded, setSongListLoaded] = useState(false)
  const [data, setData] = useState<SongHistory | null>(null)
  const [filter, setFilter] = useState('')
  const [modalTrack, setModalTrack] = useState<Track | null>(null)
  const [nowPlaying, setNowPlaying] = useState<{ url: string; date: string; song: string } | null>(null)
  const [playbackTime, setPlaybackTime] = useState({ current: 0, duration: 0 })
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

  // Sync deep-dive state to URL params (only after song list loads to avoid clobbering shared link params)
  useEffect(() => {
    if (!songListLoaded) return
    setParams({
      song: selectedSong || null,
      sort: sortBy === 'avg' ? null : sortBy,
      min: minPlayed === 5 ? null : String(minPlayed),
    })
  }, [selectedSong, sortBy, minPlayed, songListLoaded])

  // Reload song list when year changes
  useEffect(() => {
    dataSource.fetchSongList(year)
      .then((list: SongOption[]) => {
        setSongList(list)
        if (list.length > 0) {
          const urlSong = selectedSong
          const match = list.find((s: SongOption) => s.song_name === urlSong)
          if (match) {
            // Song from URL exists — if it would be hidden by minPlayed filter, lower the threshold
            if (match.times_played < minPlayed) {
              setMinPlayed(Math.max(1, match.times_played))
            }
          } else if (!urlSong) {
            // No song in URL — pick the first by default sort
            setSelectedSong(list[0].song_name)
          } else {
            // URL song doesn't exist in this year's data — fall back to first
            setSelectedSong(list[0].song_name)
          }
        }
        setSongListLoaded(true)
      })
      .catch(() => { setSongListLoaded(true) })
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch history when selection or year changes
  useEffect(() => {
    if (!selectedSong) return
    setData(null)
    dataSource.fetchSongHistory(selectedSong, year)
      .then(setData)
      .catch(() => {})
  }, [selectedSong, year])

  // D3 chart
  useEffect(() => {
    if (!svgRef.current || !data || data.tracks.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const tracks = data.tracks.filter(t => t.duration_ms > 0)
    if (tracks.length === 0) {
      svg.attr('width', 960).attr('height', 100)
      svg.append('text').attr('x', 480).attr('y', 50)
        .attr('text-anchor', 'middle').style('fill', '#999').style('font-size', '14px')
        .text('No duration data available for this song')
      return
    }

    const margin = { top: 60, right: 50, bottom: 100, left: 70 }
    const width = 960
    const height = 520

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
      .attr('fill', t => t.is_jamchart ? '#ef4444' : '#e5e7eb')
      .attr('stroke', t => t.is_jamchart ? '#b91c1c' : '#999')
      .attr('stroke-width', t => t.is_jamchart ? 2 : 1.5)
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
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })
      .on('click', (_event: MouseEvent, t) => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        setModalTrack(t)
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

  }, [data])

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
      <div data-tour="deep-dive-chart" style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} style={{ width: '100%', maxWidth: 960 }} />
      </div>
      {/* Hover tooltip — info only */}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 300,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
      {/* Click modal — track details + play button */}
      {modalTrack && (
        <div
          onClick={() => setModalTrack(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1a2e', color: 'white', borderRadius: '12px',
              padding: '24px', minWidth: 300, maxWidth: 380,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{modalTrack.show_date}</div>
                <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px' }}>{modalTrack.venue}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>{modalTrack.location}</div>
              </div>
              <button
                onClick={() => setModalTrack(null)}
                style={{
                  background: 'none', border: 'none', color: '#64748b',
                  cursor: 'pointer', fontSize: '20px', padding: '0 0 0 12px', lineHeight: 1,
                }}
              >&times;</button>
            </div>
            {modalTrack.is_jamchart ? (
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                &#9733; JAMCHART
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
              <span>Duration: <strong style={{ color: 'white' }}>{fmtDuration(modalTrack.duration_ms)}</strong></span>
              <span>Set {modalTrack.set_name}, #{modalTrack.position}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Likes: {modalTrack.likes}
            </div>
            {modalTrack.jam_notes && (
              <div style={{
                borderTop: '1px solid #334155', paddingTop: '8px', marginBottom: '12px',
                fontSize: '12px', color: '#94a3b8', lineHeight: '1.5',
              }}>
                {modalTrack.jam_notes}
              </div>
            )}
            {modalTrack.jam_url ? (
              <button
                onClick={() => {
                  playJam(modalTrack.jam_url, modalTrack.show_date, modalTrack.song_name)
                  setModalTrack(null)
                }}
                style={{
                  width: '100%', padding: '14px', background: '#22c55e', color: 'white',
                  border: '2px solid #16a34a', borderRadius: '10px', cursor: 'pointer',
                  fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  boxShadow: '0 4px 14px rgba(34,197,94,0.35)',
                }}
              >
                <span style={{ fontSize: '22px' }}>&#9654;</span>
                Play Jam
              </button>
            ) : (
              <div style={{
                width: '100%', padding: '12px', background: '#1e293b',
                borderRadius: '10px', textAlign: 'center',
                fontSize: '13px', color: '#475569',
              }}>
                No jam clip available
              </div>
            )}
          </div>
        </div>
      )}
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
              <span style={{ color: '#475569', fontSize: '12px', marginLeft: 'auto' }}>
                via PhishJustJams
              </span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
