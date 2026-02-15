import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import * as dataSource from '../api/data-source'

interface ShowHeat {
  show_date: string
  total_tracks: number
  jamchart_count: number
  total_duration_ms: number
  jam_duration_ms: number
  venue: string
  location: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function ShowHeatCalendar({ year }: { year: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ShowHeat[]>([])
  const [colorBy, setColorBy] = useState<'jc' | 'pct' | 'duration'>('jc')

  useEffect(() => {
    dataSource.fetchShowHeat(year).then(setData).catch(() => {})
  }, [year])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Group shows by year
    const byYear = d3.group(data, d => d.show_date.substring(0, 4))
    const years = [...byYear.keys()].sort()

    const cellSize = 14
    const cellGap = 2
    const yearLabelW = 48
    const monthLabelH = 18
    const yearRowH = (cellSize + cellGap) * 7 + 20

    const width = yearLabelW + 53 * (cellSize + cellGap) + 20
    const height = monthLabelH + years.length * yearRowH + 40

    svg.attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    // Color scale
    const maxJc = d3.max(data, d => d.jamchart_count) ?? 1
    const maxPct = d3.max(data, d => d.total_tracks > 0 ? d.jamchart_count / d.total_tracks : 0) ?? 1
    const maxDur = d3.max(data, d => d.jam_duration_ms) ?? 1

    function getValue(d: ShowHeat): number {
      if (colorBy === 'jc') return d.jamchart_count
      if (colorBy === 'pct') return d.total_tracks > 0 ? d.jamchart_count / d.total_tracks : 0
      return d.jam_duration_ms
    }
    function getMax(): number {
      if (colorBy === 'jc') return maxJc
      if (colorBy === 'pct') return maxPct
      return maxDur
    }

    const color = d3.scaleSequential(d3.interpolateReds)
      .domain([0, getMax()])

    // Month labels
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    // Approximate week positions for month starts
    const monthWeeks = [0, 4, 8, 13, 17, 22, 26, 30, 35, 39, 44, 48]
    svg.selectAll('.month-label')
      .data(months)
      .join('text')
      .attr('class', 'month-label')
      .attr('x', (_, i) => yearLabelW + monthWeeks[i] * (cellSize + cellGap))
      .attr('y', 12)
      .style('font-size', '10px')
      .style('fill', '#888')
      .text(d => d)

    // Day labels
    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']
    svg.selectAll('.day-label')
      .data(dayLabels)
      .join('text')
      .attr('class', 'day-label')
      .attr('x', yearLabelW - 8)
      .attr('y', (_, i) => monthLabelH + i * (cellSize + cellGap) + cellSize - 2)
      .style('font-size', '9px')
      .style('fill', '#aaa')
      .attr('text-anchor', 'end')
      .text(d => d)

    // Build a map for quick lookup
    const showMap = new Map(data.map(d => [d.show_date, d]))

    years.forEach((yr, yi) => {
      const yOffset = monthLabelH + yi * yearRowH

      // Year label
      svg.append('text')
        .attr('x', 4)
        .attr('y', yOffset + (cellSize + cellGap) * 3.5 + cellSize / 2)
        .style('font-size', '11px')
        .style('fill', '#666')
        .style('font-weight', '600')
        .text(yr)

      // Generate all days in this year
      const yearStart = new Date(parseInt(yr), 0, 1)
      const yearEnd = new Date(parseInt(yr), 11, 31)
      const allDays = d3.timeDays(yearStart, d3.timeDay.offset(yearEnd, 1))

      allDays.forEach(day => {
        const dateStr = d3.timeFormat('%Y-%m-%d')(day)
        const show = showMap.get(dateStr)
        const weekOfYear = d3.timeWeek.count(d3.timeYear(day), day)
        const dayOfWeek = day.getDay()

        const cx = yearLabelW + weekOfYear * (cellSize + cellGap)
        const cy = yOffset + dayOfWeek * (cellSize + cellGap)

        const rect = svg.append('rect')
          .attr('x', cx)
          .attr('y', cy)
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('rx', 2)

        if (show) {
          rect
            .attr('fill', color(getValue(show)))
            .attr('stroke', show.jamchart_count > 0 ? '#b91c1c' : '#ccc')
            .attr('stroke-width', show.jamchart_count > 0 ? 1 : 0.5)
            .style('cursor', 'pointer')
        } else {
          rect.attr('fill', '#f0f0f0').attr('stroke', 'none')
        }

        // Tooltip for show days
        if (show) {
          rect.on('mousemove', (event: MouseEvent) => {
            if (!tooltipRef.current) return
            const tip = tooltipRef.current
            const pct = show.total_tracks > 0
              ? Math.round(100 * show.jamchart_count / show.total_tracks)
              : 0
            tip.innerHTML = [
              `<strong>${esc(show.show_date)}</strong>`,
              `${esc(show.venue)}`,
              `${esc(show.location)}`,
              ``,
              `Tracks: ${show.total_tracks}`,
              `Jamcharts: <strong style="color:#ef4444">${show.jamchart_count}</strong> (${pct}%)`,
              `Show length: ${fmtDuration(show.total_duration_ms)}`,
              `Jam time: ${fmtDuration(show.jam_duration_ms)}`,
            ].join('<br/>')
            tip.style.display = 'block'
            tip.style.left = `${event.clientX + 12}px`
            tip.style.top = `${event.clientY - 10}px`
          })
          .on('mouseleave', () => {
            if (tooltipRef.current) tooltipRef.current.style.display = 'none'
          })
        }
      })
    })

    // Legend
    const legendX = yearLabelW
    const legendY = height - 20
    const legendW = 120
    const legendSteps = 6
    const stepW = legendW / legendSteps

    for (let i = 0; i <= legendSteps; i++) {
      svg.append('rect')
        .attr('x', legendX + i * stepW)
        .attr('y', legendY)
        .attr('width', stepW)
        .attr('height', 10)
        .attr('rx', 1)
        .attr('fill', color(getMax() * i / legendSteps))
    }

    svg.append('text')
      .attr('x', legendX - 4)
      .attr('y', legendY + 9)
      .style('font-size', '9px').style('fill', '#999')
      .attr('text-anchor', 'end')
      .text('0')

    const maxLabel = colorBy === 'jc' ? `${maxJc} JC`
      : colorBy === 'pct' ? `${Math.round(maxPct * 100)}%`
      : fmtDuration(maxDur)
    svg.append('text')
      .attr('x', legendX + legendW + 6)
      .attr('y', legendY + 9)
      .style('font-size', '9px').style('fill', '#999')
      .text(maxLabel)

    // Stats line
    const totalJc = d3.sum(data, d => d.jamchart_count)
    const avgJcPerShow = data.length > 0 ? (totalJc / data.length).toFixed(1) : '0'
    const hottest = data.reduce((a, b) => a.jamchart_count > b.jamchart_count ? a : b, data[0])

    svg.append('text')
      .attr('x', legendX + legendW + 80)
      .attr('y', legendY + 9)
      .style('font-size', '10px').style('fill', '#999')
      .text(`${data.length} shows, ${totalJc} jamcharts, avg ${avgJcPerShow}/show. Hottest: ${hottest.show_date} (${hottest.jamchart_count} JC) @ ${hottest.venue}`)

  }, [data, colorBy])

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        GitHub-style heatmap of every Phish 3.0 show. Darker cells = more jamcharts. Hover for show details.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem' }}>
          Color by:
          <select
            value={colorBy}
            onChange={e => setColorBy(e.target.value as 'jc' | 'pct' | 'duration')}
            style={{ marginLeft: '0.5rem', padding: '0.3rem', fontSize: '0.85rem' }}
          >
            <option value="jc">Jamchart Count</option>
            <option value="pct">Jamchart Rate</option>
            <option value="duration">Jam Time</option>
          </select>
        </label>
      </div>
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
