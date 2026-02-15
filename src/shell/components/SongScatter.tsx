import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

interface HeatmapRow {
  song: string
  [username: string]: string | number
}

interface Props {
  allUsernames: string[]
  matrix: HeatmapRow[]
}

const USER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c']

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function SongScatter({ allUsernames, matrix }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [userX, setUserX] = useState(allUsernames[0])
  const [userY, setUserY] = useState(allUsernames[1] || allUsernames[0])

  useEffect(() => {
    if (!svgRef.current || matrix.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 30, right: 30, bottom: 60, left: 60 }
    const width = 700
    const height = 700

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    const data = matrix
      .map(row => ({
        song: row.song as string,
        x: row[userX] as number,
        y: row[userY] as number,
      }))
      .filter(d => d.x > 0 || d.y > 0)

    const maxVal = Math.max(
      d3.max(data, d => d.x) ?? 1,
      d3.max(data, d => d.y) ?? 1,
    )

    const x = d3.scaleLinear().domain([0, maxVal]).range([margin.left, width - margin.right])
    const y = d3.scaleLinear().domain([0, maxVal]).range([height - margin.bottom, margin.top])

    // Grid
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10))
      .selectAll('text').style('font-size', '11px')

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(10))
      .selectAll('text').style('font-size', '11px')

    // Axis labels
    const colorX = USER_COLORS[allUsernames.indexOf(userX) % USER_COLORS.length]
    const colorY = USER_COLORS[allUsernames.indexOf(userY) % USER_COLORS.length]

    svg.append('text')
      .attr('x', width / 2).attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px').style('fill', colorX).style('font-weight', '600')
      .text(`${userX} (shows seen)`)

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', 16)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px').style('fill', colorY).style('font-weight', '600')
      .text(`${userY} (shows seen)`)

    // Diagonal "equal line"
    svg.append('line')
      .attr('x1', x(0)).attr('y1', y(0))
      .attr('x2', x(maxVal)).attr('y2', y(maxVal))
      .attr('stroke', '#ddd').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')

    // Dots
    svg.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))
      .attr('r', d => Math.max(3, Math.min(8, 2 + (d.x + d.y) / 4)))
      .attr('fill', d => {
        if (d.x > 0 && d.y === 0) return colorX
        if (d.y > 0 && d.x === 0) return colorY
        const ratio = d.x / (d.x + d.y)
        return d3.interpolateRgb(colorY, colorX)(ratio)
      })
      .attr('opacity', 0.7)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent, d) => {
        if (!tooltipRef.current) return
        const tip = tooltipRef.current
        tip.innerHTML = `<strong>${esc(d.song)}</strong><br/>`
          + `<span style="color:${colorX}">\u25CF</span> ${esc(userX)}: <strong>${d.x}</strong><br/>`
          + `<span style="color:${colorY}">\u25CF</span> ${esc(userY)}: <strong>${d.y}</strong>`
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // Label outliers (songs with biggest difference)
    const outliers = [...data]
      .sort((a, b) => Math.abs(b.x - b.y) - Math.abs(a.x - a.y))
      .slice(0, 8)

    svg.selectAll('.outlier-label')
      .data(outliers)
      .join('text')
      .attr('class', 'outlier-label')
      .attr('x', d => x(d.x) + 6)
      .attr('y', d => y(d.y) - 6)
      .style('font-size', '9px')
      .style('fill', '#555')
      .style('pointer-events', 'none')
      .text(d => d.song.length > 18 ? d.song.slice(0, 16) + '\u2026' : d.song)
  }, [userX, userY, matrix, allUsernames.join(',')])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem' }}>
          X axis:
          <select value={userX} onChange={e => setUserX(e.target.value)} style={{ marginLeft: '0.5rem' }}>
            {allUsernames.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          Y axis:
          <select value={userY} onChange={e => setUserY(e.target.value)} style={{ marginLeft: '0.5rem' }}>
            {allUsernames.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <span style={{ fontSize: '0.8rem', color: '#999' }}>
          Dots above the line = {userY} saw more. Below = {userX} saw more.
        </span>
      </div>
      <svg ref={svgRef} style={{ width: '100%', maxWidth: 700 }} />
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 300,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}
