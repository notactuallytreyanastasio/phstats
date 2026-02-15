import { useRef, useEffect } from 'react'
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

export default function JamVehicleScatter({ songs }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || songs.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 30, right: 30, bottom: 60, left: 70 }
    const width = 900
    const height = 600

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    // Only songs with at least 1 jamchart for the scatter
    const data = songs.filter(s => s.jamchart_count > 0)

    const maxShows = d3.max(data, d => d.total_shows) ?? 1
    const maxPct = d3.max(data, d => d.jamchart_pct) ?? 100

    const x = d3.scaleLinear().domain([0, maxShows * 1.05]).range([margin.left, width - margin.right])
    const y = d3.scaleLinear().domain([0, Math.min(100, maxPct * 1.1)]).range([height - margin.bottom, margin.top])
    const r = d3.scaleSqrt().domain([1, d3.max(data, d => d.jamchart_count) ?? 1]).range([3, 20])

    // Color: jamchart percentage mapped to warm scale
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, Math.min(100, maxPct)])

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10))
      .selectAll('text').style('font-size', '11px')

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(10).tickFormat(d => `${d}%`))
      .selectAll('text').style('font-size', '11px')

    // Axis labels
    svg.append('text')
      .attr('x', width / 2).attr('y', height - 8)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px').style('fill', '#555').style('font-weight', '600')
      .text('Total Shows Played')

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px').style('fill', '#555').style('font-weight', '600')
      .text('Jamchart Rate (%)')

    // Quadrant guides
    const medianShows = d3.median(data, d => d.total_shows) ?? 20
    const medianPct = d3.median(data.filter(d => d.jamchart_pct > 0), d => d.jamchart_pct) ?? 30

    svg.append('line')
      .attr('x1', x(medianShows)).attr('x2', x(medianShows))
      .attr('y1', margin.top).attr('y2', height - margin.bottom)
      .attr('stroke', '#e0e0e0').attr('stroke-width', 1).attr('stroke-dasharray', '4,4')

    svg.append('line')
      .attr('x1', margin.left).attr('x2', width - margin.right)
      .attr('y1', y(medianPct)).attr('y2', y(medianPct))
      .attr('stroke', '#e0e0e0').attr('stroke-width', 1).attr('stroke-dasharray', '4,4')

    // Quadrant labels
    const qStyle = { fontSize: '10px', fill: '#bbb', fontStyle: 'italic' }
    svg.append('text').attr('x', margin.left + 6).attr('y', margin.top + 14).style('font-size', qStyle.fontSize).style('fill', qStyle.fill).text('Rare gems')
    svg.append('text').attr('x', width - margin.right - 6).attr('y', margin.top + 14).attr('text-anchor', 'end').style('font-size', qStyle.fontSize).style('fill', qStyle.fill).text('JAM VEHICLES')
    svg.append('text').attr('x', width - margin.right - 6).attr('y', height - margin.bottom - 6).attr('text-anchor', 'end').style('font-size', qStyle.fontSize).style('fill', qStyle.fill).text('Staples (rarely jammed)')

    // Bubbles
    svg.selectAll('circle')
      .data(data.sort((a, b) => b.jamchart_count - a.jamchart_count)) // big ones first (painted behind)
      .join('circle')
      .attr('cx', d => x(d.total_shows))
      .attr('cy', d => y(d.jamchart_pct))
      .attr('r', d => r(d.jamchart_count))
      .attr('fill', d => color(d.jamchart_pct))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent, d) => {
        if (!tooltipRef.current) return
        const tip = tooltipRef.current
        tip.innerHTML = `<strong>${esc(d.song_name)}</strong><br/>`
          + `Shows played: <strong>${d.total_shows}</strong><br/>`
          + `Jamcharts: <strong>${d.jamchart_count}</strong> (${d.jamchart_pct}%)`
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // Label top jam vehicles (upper-right quadrant, top 12 by jamchart_count)
    const topVehicles = data
      .filter(d => d.total_shows >= medianShows && d.jamchart_pct >= medianPct)
      .sort((a, b) => b.jamchart_count - a.jamchart_count)
      .slice(0, 12)

    svg.selectAll('.vehicle-label')
      .data(topVehicles)
      .join('text')
      .attr('class', 'vehicle-label')
      .attr('x', d => x(d.total_shows) + r(d.jamchart_count) + 3)
      .attr('y', d => y(d.jamchart_pct) + 3)
      .style('font-size', '10px')
      .style('fill', '#444')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .text(d => d.song_name.length > 20 ? d.song_name.slice(0, 18) + '\u2026' : d.song_name)

    // Also label notable rare gems (high pct, low shows)
    const rareGems = data
      .filter(d => d.total_shows < medianShows && d.jamchart_pct >= medianPct && d.jamchart_count >= 3)
      .sort((a, b) => b.jamchart_pct - a.jamchart_pct)
      .slice(0, 6)

    svg.selectAll('.gem-label')
      .data(rareGems)
      .join('text')
      .attr('class', 'gem-label')
      .attr('x', d => x(d.total_shows) + r(d.jamchart_count) + 3)
      .attr('y', d => y(d.jamchart_pct) + 3)
      .style('font-size', '9px')
      .style('fill', '#888')
      .style('font-style', 'italic')
      .style('pointer-events', 'none')
      .text(d => d.song_name.length > 20 ? d.song_name.slice(0, 18) + '\u2026' : d.song_name)
  }, [songs])

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        Upper right = true jam vehicles (played often + high jam rate). Bubble size = jamchart count.
      </p>
      <svg ref={svgRef} style={{ width: '100%', maxWidth: 900 }} />
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 300,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}
