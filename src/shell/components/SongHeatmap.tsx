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

const USER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'] // blue, red, green, purple, orange

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function SongHeatmap({ allUsernames, matrix }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set(allUsernames))
  const [minShows, setMinShows] = useState(2)

  // Sync selected users when allUsernames changes
  useEffect(() => {
    setSelectedUsers(new Set(allUsernames))
  }, [allUsernames.join(',')])

  const toggleUser = (username: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev)
      if (next.has(username)) {
        if (next.size > 1) next.delete(username) // keep at least 1
      } else {
        next.add(username)
      }
      return next
    })
  }

  const activeUsers = allUsernames.filter(u => selectedUsers.has(u))

  useEffect(() => {
    if (!svgRef.current || matrix.length === 0 || activeUsers.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = 800

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    // Filter songs: total across selected users must meet minShows threshold
    const filtered = matrix.filter(row => {
      const total = activeUsers.reduce((sum, u) => sum + (row[u] as number), 0)
      return total >= minShows
    })

    if (filtered.length === 0) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#999').style('font-size', '16px')
        .text('No songs match the current filter. Try lowering the minimum.')
      return
    }

    // Build hierarchy for treemap
    const root = d3.hierarchy({
      name: 'root',
      children: filtered.map(row => {
        const total = activeUsers.reduce((sum, u) => sum + (row[u] as number), 0)
        return { name: row.song, value: total, row }
      }),
    }).sum(d => (d as any).value || 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    d3.treemap<any>()
      .size([width, height])
      .padding(2)
      .round(true)(root)

    const leaves = root.leaves()

    const cell = svg.selectAll('g')
      .data(leaves)
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)

    // For each cell, draw split-color bands (one per user, stacked vertically)
    cell.each(function(d) {
      const g = d3.select(this)
      const w = d.x1 - d.x0
      const h = d.y1 - d.y0
      const row = d.data.row
      const counts = activeUsers.map(u => row[u] as number)
      const total = counts.reduce((a, b) => a + b, 0)

      if (total === 0) {
        g.append('rect')
          .attr('width', w).attr('height', h)
          .attr('rx', 3).attr('fill', '#e5e7eb')
        return
      }

      // Draw stacked horizontal bands per user
      let yOffset = 0
      for (let i = 0; i < activeUsers.length; i++) {
        const proportion = counts[i] / total
        const bandHeight = proportion * h
        if (bandHeight < 0.5) { yOffset += bandHeight; continue }

        const colorIdx = allUsernames.indexOf(activeUsers[i])
        g.append('rect')
          .attr('y', yOffset)
          .attr('width', w)
          .attr('height', bandHeight)
          .attr('fill', USER_COLORS[colorIdx % USER_COLORS.length])
          .attr('opacity', 0.85)
        yOffset += bandHeight
      }

      // Border rect on top for clean edges
      g.append('rect')
        .attr('width', w).attr('height', h)
        .attr('rx', 3)
        .attr('fill', 'none')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)

      // Clip rounded corners
      const clipId = `clip-${d.data.name.replace(/[^a-zA-Z0-9]/g, '-')}-${d.x0}-${d.y0}`
      g.insert('clipPath', ':first-child')
        .attr('id', clipId)
        .append('rect')
        .attr('width', w).attr('height', h).attr('rx', 3)
      g.selectAll('rect:not(clipPath rect)').attr('clip-path', `url(#${clipId})`)

      // Song label if cell is large enough
      if (w >= 40 && h >= 16) {
        const fontSize = Math.min(12, Math.max(8, w / d.data.name.length * 1.4))
        const maxChars = Math.floor(w / (fontSize * 0.55))
        const label = d.data.name.length > maxChars
          ? d.data.name.slice(0, maxChars) + '\u2026'
          : d.data.name

        g.append('text')
          .attr('x', 4).attr('y', fontSize + 2)
          .style('font-size', `${fontSize}px`)
          .style('font-family', 'system-ui')
          .style('font-weight', '600')
          .style('fill', 'white')
          .style('text-shadow', '0 1px 3px rgba(0,0,0,0.7)')
          .style('pointer-events', 'none')
          .text(label)

        // Per-user count line if room
        if (h > 32) {
          const countParts = activeUsers.map(u => `${row[u]}`)
          g.append('text')
            .attr('x', 4).attr('y', fontSize + 16)
            .style('font-size', '9px')
            .style('font-family', 'system-ui')
            .style('fill', 'rgba(255,255,255,0.9)')
            .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
            .style('pointer-events', 'none')
            .text(countParts.join(' / '))
        }
      }

      // Invisible rect for hover events
      g.append('rect')
        .attr('width', w).attr('height', h)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mousemove', (event: MouseEvent) => {
          if (!tooltipRef.current) return
          const tip = tooltipRef.current
          const lines = [`<strong>${esc(row.song as string)}</strong>`]
          for (const u of activeUsers) {
            const colorIdx = allUsernames.indexOf(u)
            const color = USER_COLORS[colorIdx % USER_COLORS.length]
            const count = row[u] as number
            lines.push(
              `<span style="color:${color}">\u25CF</span> ${esc(u)}: <strong>${count}</strong> show${count !== 1 ? 's' : ''}`
            )
          }
          tip.innerHTML = lines.join('<br/>')
          tip.style.display = 'block'
          tip.style.left = `${event.clientX + 12}px`
          tip.style.top = `${event.clientY - 10}px`
        })
        .on('mouseleave', () => {
          if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        })
    })
  }, [activeUsers.join(','), matrix, minShows, allUsernames.join(',')])

  return (
    <div style={{ position: 'relative' }}>
      {/* User picker checkboxes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {allUsernames.map((u, i) => (
            <label
              key={u}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '0.85rem', cursor: 'pointer',
                opacity: selectedUsers.has(u) ? 1 : 0.4,
              }}
            >
              <input
                type="checkbox"
                checked={selectedUsers.has(u)}
                onChange={() => toggleUser(u)}
                style={{ accentColor: USER_COLORS[i % USER_COLORS.length] }}
              />
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                background: USER_COLORS[i % USER_COLORS.length],
                display: 'inline-block',
              }} />
              {u}
            </label>
          ))}
        </div>
        <label style={{ fontSize: '0.85rem', color: '#666', marginLeft: 'auto' }}>
          Min shows:
          <input
            type="range"
            min={1} max={30}
            value={minShows}
            onChange={e => setMinShows(Number(e.target.value))}
            style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
          />
          <span style={{ marginLeft: '0.25rem' }}>{minShows}</span>
        </label>
      </div>

      <svg ref={svgRef} style={{ width: '100%', maxWidth: 1200 }} />

      {/* Floating tooltip */}
      <div
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'fixed',
          background: 'rgba(0,0,0,0.88)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          lineHeight: '1.5',
          pointerEvents: 'none',
          zIndex: 1000,
          maxWidth: 300,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )
}
