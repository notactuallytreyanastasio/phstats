import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import * as dataSource from '../api/data-source'

interface VenueRow {
  venue: string
  location: string
  total_shows: number
  total_tracks: number
  jamchart_count: number
  jamchart_pct: number
  avg_duration_ms: number
}

function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000)
  return `${m}m`
}

export default function VenueRankings({ year }: { year: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<VenueRow[]>([])

  useEffect(() => {
    dataSource.fetchVenueStats(year).then(setData).catch(() => {})
  }, [year])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const top = data.slice(0, 30)

    const margin = { top: 20, right: 30, bottom: 30, left: 200 }
    const barH = 22
    const gap = 4
    const width = 700
    const height = margin.top + margin.bottom + top.length * (barH + gap)

    svg.attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    const maxJc = d3.max(top, d => d.jamchart_count) ?? 1

    const x = d3.scaleLinear()
      .domain([0, maxJc])
      .range([0, width - margin.left - margin.right])

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Bars
    g.selectAll('.bar')
      .data(top)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (_, i) => i * (barH + gap))
      .attr('width', d => x(d.jamchart_count))
      .attr('height', barH)
      .attr('rx', 3)
      .attr('fill', d => {
        const pct = d.total_tracks > 0 ? d.jamchart_count / d.total_tracks : 0
        return d3.interpolateReds(0.3 + pct * 0.7)
      })
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent, d: VenueRow) => {
        if (!tooltipRef.current) return
        const tip = tooltipRef.current
        tip.innerHTML = [
          `<strong>${esc(d.venue)}</strong>`,
          `${esc(d.location)}`,
          ``,
          `Shows: ${d.total_shows}`,
          `Tracks: ${d.total_tracks}`,
          `Jamcharts: <strong style="color:#ef4444">${d.jamchart_count}</strong> (${d.jamchart_pct}%)`,
          `Avg track: ${fmtDuration(d.avg_duration_ms)}`,
        ].join('<br/>')
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // JC count labels on bars
    g.selectAll('.bar-label')
      .data(top)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => x(d.jamchart_count) + 4)
      .attr('y', (_, i) => i * (barH + gap) + barH / 2 + 4)
      .style('font-size', '11px')
      .style('fill', '#666')
      .text(d => `${d.jamchart_count} JC (${d.jamchart_pct}%)`)

    // Venue name labels
    g.selectAll('.venue-label')
      .data(top)
      .join('text')
      .attr('class', 'venue-label')
      .attr('x', -6)
      .attr('y', (_, i) => i * (barH + gap) + barH / 2 + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '11px')
      .style('fill', '#333')
      .text(d => d.venue.length > 28 ? d.venue.slice(0, 26) + '…' : d.venue)

    // Show count in parentheses
    g.selectAll('.show-label')
      .data(top)
      .join('text')
      .attr('class', 'show-label')
      .attr('x', -6)
      .attr('y', (_, i) => i * (barH + gap) + barH / 2 + 14)
      .attr('text-anchor', 'end')
      .style('font-size', '9px')
      .style('fill', '#999')
      .text(d => `${d.total_shows} shows · ${esc(d.location)}`)

  }, [data])

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        Top 30 venues ranked by total jamchart entries. Darker bars = higher jamchart rate. Hover for details.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} style={{ width: '100%' }} />
      </div>
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 320,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
