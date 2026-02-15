import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import * as dataSource from '../api/data-source'

interface YearRow {
  year: number
  total_shows: number
  total_tracks: number
  jamchart_count: number
  jc_per_show: number
  avg_duration_ms: number
  avg_jam_duration_ms: number
  new_vehicles: string[]
}

function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000)
  return `${m}m`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function JamEvolution() {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<YearRow[]>([])
  const [metric, setMetric] = useState<'jc_per_show' | 'avg_jam_duration_ms' | 'jamchart_count'>('jc_per_show')

  useEffect(() => {
    dataSource.fetchJamEvolution().then(setData).catch(() => {})
  }, [])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 30, right: 40, bottom: 60, left: 50 }
    const width = 700
    const height = 380
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    svg.attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year) as [number, number])
      .range([0, innerW])

    const getValue = (d: YearRow) => {
      if (metric === 'jc_per_show') return d.jc_per_show
      if (metric === 'avg_jam_duration_ms') return d.avg_jam_duration_ms
      return d.jamchart_count
    }

    const maxVal = d3.max(data, getValue) ?? 1
    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([innerH, 0])

    // Grid lines
    g.selectAll('.grid-line')
      .data(y.ticks(5))
      .join('line')
      .attr('class', 'grid-line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', '#eee')

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat(d => String(d)).ticks(data.length))
      .selectAll('text')
      .style('font-size', '10px')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')

    // Y axis
    const yAxis = metric === 'avg_jam_duration_ms'
      ? d3.axisLeft(y).ticks(5).tickFormat(d => fmtDuration(d as number))
      : d3.axisLeft(y).ticks(5)
    g.append('g').call(yAxis).selectAll('text').style('font-size', '10px')

    // Y label
    const yLabel = metric === 'jc_per_show' ? 'Jamcharts per Show'
      : metric === 'avg_jam_duration_ms' ? 'Avg Jam Duration'
      : 'Total Jamcharts'
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -38)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px').style('fill', '#888')
      .text(yLabel)

    // Line
    const line = d3.line<YearRow>()
      .x(d => x(d.year))
      .y(d => y(getValue(d)))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2.5)
      .attr('d', line)

    // Area fill
    const area = d3.area<YearRow>()
      .x(d => x(d.year))
      .y0(innerH)
      .y1(d => y(getValue(d)))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('fill', 'rgba(239, 68, 68, 0.08)')
      .attr('d', area)

    // Dots
    g.selectAll('.dot')
      .data(data)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(getValue(d)))
      .attr('r', 5)
      .attr('fill', '#ef4444')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent, d: YearRow) => {
        if (!tooltipRef.current) return
        const tip = tooltipRef.current
        const vehicles = d.new_vehicles.length > 0
          ? `New jam vehicles: ${d.new_vehicles.map(esc).join(', ')}`
          : 'No new jam vehicles'
        tip.innerHTML = [
          `<strong>${d.year}</strong>`,
          ``,
          `Shows: ${d.total_shows}`,
          `Tracks: ${d.total_tracks}`,
          `Jamcharts: <strong style="color:#ef4444">${d.jamchart_count}</strong>`,
          `JC/show: ${d.jc_per_show}`,
          `Avg track: ${fmtDuration(d.avg_duration_ms)}`,
          `Avg jam: ${fmtDuration(d.avg_jam_duration_ms)}`,
          ``,
          vehicles,
        ].join('<br/>')
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // New vehicle annotations
    data.forEach(d => {
      if (d.new_vehicles.length > 0) {
        const cx = x(d.year)
        const cy = y(getValue(d))
        g.append('text')
          .attr('x', cx)
          .attr('y', cy - 14)
          .attr('text-anchor', 'middle')
          .style('font-size', '8px')
          .style('fill', '#b91c1c')
          .text(`+${d.new_vehicles.length} new`)
      }
    })

  }, [data, metric])

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        How Phish's jamming has evolved year by year. Dots show yearly totals; hover for details and new jam vehicles.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem' }}>
          Metric:
          <select
            value={metric}
            onChange={e => setMetric(e.target.value as typeof metric)}
            style={{ marginLeft: '0.5rem', padding: '0.3rem', fontSize: '0.85rem' }}
          >
            <option value="jc_per_show">Jamcharts per Show</option>
            <option value="jamchart_count">Total Jamcharts</option>
            <option value="avg_jam_duration_ms">Avg Jam Duration</option>
          </select>
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} style={{ width: '100%' }} />
      </div>
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 360,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}
