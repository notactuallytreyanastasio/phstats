import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

interface JamSong {
  song_name: string
  total_shows: number
  jamchart_count: number
  jamchart_pct: number
}

interface Props {
  songs: JamSong[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type SortMode = 'jamcharts' | 'pct' | 'total'

export default function JamchartRankings({ songs }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [sortMode, setSortMode] = useState<SortMode>('jamcharts')
  const [limit, setLimit] = useState(30)

  useEffect(() => {
    if (!svgRef.current || songs.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const withJams = songs.filter(s => s.jamchart_count > 0)
    const sorted = [...withJams].sort((a, b) => {
      if (sortMode === 'jamcharts') return b.jamchart_count - a.jamchart_count
      if (sortMode === 'pct') return b.jamchart_pct - a.jamchart_pct
      return b.total_shows - a.total_shows
    }).slice(0, limit)

    const margin = { top: 20, right: 60, bottom: 30, left: 180 }
    const barH = 22
    const gap = 4
    const height = margin.top + margin.bottom + sorted.length * (barH + gap)
    const width = 800

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    const maxShows = d3.max(sorted, d => d.total_shows) ?? 1

    const x = d3.scaleLinear().domain([0, maxShows]).range([margin.left, width - margin.right])
    const yPos = (i: number) => margin.top + i * (barH + gap)

    // Song labels
    svg.selectAll('.song-label')
      .data(sorted)
      .join('text')
      .attr('class', 'song-label')
      .attr('x', margin.left - 6)
      .attr('y', (_, i) => yPos(i) + barH / 2 + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '11px').style('fill', '#444')
      .text(d => d.song_name.length > 24 ? d.song_name.slice(0, 22) + '\u2026' : d.song_name)

    // Background bar (total shows)
    svg.selectAll('.bar-total')
      .data(sorted)
      .join('rect')
      .attr('class', 'bar-total')
      .attr('x', margin.left)
      .attr('y', (_, i) => yPos(i))
      .attr('width', d => x(d.total_shows) - margin.left)
      .attr('height', barH)
      .attr('rx', 3)
      .attr('fill', '#e5e7eb')

    // Foreground bar (jamcharts)
    svg.selectAll('.bar-jam')
      .data(sorted)
      .join('rect')
      .attr('class', 'bar-jam')
      .attr('x', margin.left)
      .attr('y', (_, i) => yPos(i))
      .attr('width', d => x(d.jamchart_count) - margin.left)
      .attr('height', barH)
      .attr('rx', 3)
      .attr('fill', '#ef4444')
      .attr('opacity', 0.85)

    // Count labels
    svg.selectAll('.count-label')
      .data(sorted)
      .join('text')
      .attr('class', 'count-label')
      .attr('x', d => x(d.total_shows) + 4)
      .attr('y', (_, i) => yPos(i) + barH / 2 + 4)
      .style('font-size', '10px').style('fill', '#999')
      .text(d => `${d.jamchart_count}/${d.total_shows} (${d.jamchart_pct}%)`)

    // Hover rects
    svg.selectAll('.hover-rect')
      .data(sorted)
      .join('rect')
      .attr('class', 'hover-rect')
      .attr('x', 0)
      .attr('y', (_, i) => yPos(i))
      .attr('width', width)
      .attr('height', barH)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent, d) => {
        if (!tooltipRef.current) return
        const tip = tooltipRef.current
        tip.innerHTML = `<strong>${esc(d.song_name)}</strong><br/>`
          + `Total shows: ${d.total_shows}<br/>`
          + `Jamcharts: <strong style="color:#ef4444">${d.jamchart_count}</strong> (${d.jamchart_pct}%)`
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // Axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(8))
      .selectAll('text').style('font-size', '10px')
  }, [songs, sortMode, limit])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem' }}>
          Sort by:
          <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} style={{ marginLeft: '0.5rem' }}>
            <option value="jamcharts">Jamchart Count</option>
            <option value="pct">Jamchart Rate %</option>
            <option value="total">Total Shows</option>
          </select>
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          Show top:
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ marginLeft: '0.5rem' }}>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </label>
        <span style={{ fontSize: '0.8rem', color: '#999' }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#ef4444', borderRadius: 2, verticalAlign: 'middle' }} /> Jamcharts
          <span style={{ display: 'inline-block', width: 12, height: 12, background: '#e5e7eb', borderRadius: 2, verticalAlign: 'middle', marginLeft: 12 }} /> Total shows
        </span>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: '70vh' }}>
        <svg ref={svgRef} style={{ width: '100%', maxWidth: 800 }} />
      </div>
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 300,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}
