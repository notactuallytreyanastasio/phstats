import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

interface ShowRecord {
  username: string
  date: string
  venue: string
  city: string
  state: string
}

interface Props {
  allShows: ShowRecord[]
  allUsernames: string[]
}

const USER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c']

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function ShowTimeline({ allShows, allUsernames }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || allShows.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 40, right: 30, bottom: 40, left: 30 }
    const width = 1200
    const rowHeight = 50
    const height = margin.top + margin.bottom + allUsernames.length * rowHeight + 40

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    const parseDate = d3.timeParse('%Y-%m-%d')
    const dates = allShows.map(s => parseDate(s.date)!).filter(Boolean)
    const dateExtent = d3.extent(dates) as [Date, Date]

    const x = d3.scaleTime()
      .domain(dateExtent)
      .range([margin.left + 140, width - margin.right])

    // Time axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(2)))
      .selectAll('text').style('font-size', '11px')

    // Group shows by date to detect shared shows
    const byDate = new Map<string, Set<string>>()
    for (const s of allShows) {
      const users = byDate.get(s.date) ?? new Set()
      users.add(s.username)
      byDate.set(s.date, users)
    }

    // Draw rows per user
    allUsernames.forEach((username, i) => {
      const yRow = margin.top + i * rowHeight + rowHeight / 2
      const color = USER_COLORS[i % USER_COLORS.length]

      // Row label
      svg.append('text')
        .attr('x', margin.left).attr('y', yRow + 4)
        .style('font-size', '13px').style('fill', color).style('font-weight', '600')
        .text(username)

      // Horizontal guide line
      svg.append('line')
        .attr('x1', margin.left + 140).attr('x2', width - margin.right)
        .attr('y1', yRow).attr('y2', yRow)
        .attr('stroke', '#eee').attr('stroke-width', 1)

      // Dots for this user's shows
      const userShows = allShows.filter(s => s.username === username)

      svg.selectAll(`.dot-${i}`)
        .data(userShows)
        .join('circle')
        .attr('class', `dot-${i}`)
        .attr('cx', d => x(parseDate(d.date)!))
        .attr('cy', yRow)
        .attr('r', d => {
          const users = byDate.get(d.date)!
          return users.size > 1 ? 5 : 3.5
        })
        .attr('fill', d => {
          const users = byDate.get(d.date)!
          return users.size > 1 ? '#fbbf24' : color // gold for shared shows
        })
        .attr('stroke', d => {
          const users = byDate.get(d.date)!
          return users.size > 1 ? color : 'none'
        })
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
        .style('cursor', 'pointer')
        .on('mousemove', (event: MouseEvent, d) => {
          if (!tooltipRef.current) return
          const tip = tooltipRef.current
          const users = byDate.get(d.date)!
          const shared = users.size > 1
            ? `<br/><em style="color:#fbbf24">Shared show! Also: ${[...users].filter(u => u !== username).map(esc).join(', ')}</em>`
            : ''
          tip.innerHTML = `<strong>${d.date}</strong><br/>${esc(d.venue)}<br/>${esc(d.city)}, ${esc(d.state)}${shared}`
          tip.style.display = 'block'
          tip.style.left = `${event.clientX + 12}px`
          tip.style.top = `${event.clientY - 10}px`
        })
        .on('mouseleave', () => {
          if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        })
    })

    // Shared shows: draw vertical connector lines
    for (const [date, users] of byDate) {
      if (users.size < 2) continue
      const xPos = x(parseDate(date)!)
      const indices = allUsernames
        .map((u, i) => users.has(u) ? i : -1)
        .filter(i => i >= 0)
      const yMin = margin.top + Math.min(...indices) * rowHeight + rowHeight / 2
      const yMax = margin.top + Math.max(...indices) * rowHeight + rowHeight / 2

      svg.append('line')
        .attr('x1', xPos).attr('x2', xPos)
        .attr('y1', yMin).attr('y2', yMax)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1)
        .attr('opacity', 0.3)
    }

    // Legend
    svg.append('circle').attr('cx', margin.left + 140).attr('cy', margin.top - 20).attr('r', 4).attr('fill', '#999')
    svg.append('text').attr('x', margin.left + 150).attr('y', margin.top - 16).style('font-size', '11px').style('fill', '#666').text('Solo show')
    svg.append('circle').attr('cx', margin.left + 230).attr('cy', margin.top - 20).attr('r', 5).attr('fill', '#fbbf24').attr('stroke', '#999').attr('stroke-width', 1.5)
    svg.append('text').attr('x', margin.left + 240).attr('y', margin.top - 16).style('font-size', '11px').style('fill', '#666').text('Shared show')
  }, [allShows, allUsernames.join(',')])

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', maxWidth: 1200 }} />
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 300,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}
