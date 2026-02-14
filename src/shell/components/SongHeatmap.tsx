import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

interface HeatmapRow {
  song: string
  [username: string]: string | number
}

interface Props {
  usernames: string[]
  matrix: HeatmapRow[]
}

// User color assignments
const USER_COLORS = ['#2563eb', '#dc2626', '#16a34a'] // blue, red, green

export default function SongHeatmap({ usernames, matrix }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [minShows, setMinShows] = useState(2)

  useEffect(() => {
    if (!svgRef.current || matrix.length === 0 || usernames.length < 2) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = 800

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    // Filter songs: at least one user must have seen it minShows times
    const filtered = matrix.filter(row => {
      const total = usernames.reduce((sum, u) => sum + (row[u] as number), 0)
      return total >= minShows
    })

    if (filtered.length === 0) return

    // Build hierarchy for treemap
    const root = d3.hierarchy({
      name: 'root',
      children: filtered.map(row => {
        const total = usernames.reduce((sum, u) => sum + (row[u] as number), 0)
        return { name: row.song, value: total, row }
      }),
    }).sum(d => (d as any).value || 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    d3.treemap<any>()
      .size([width, height])
      .padding(2)
      .round(true)(root)

    // Color function: blend between user colors based on proportions
    function getCellColor(row: HeatmapRow): string {
      const counts = usernames.map(u => row[u] as number)
      const total = counts.reduce((a, b) => a + b, 0)
      if (total === 0) return '#e5e7eb'

      if (usernames.length === 2) {
        // Diverging scale: user0 = blue, user1 = red
        const ratio = counts[0] / total // 0 = all user1, 1 = all user0
        return d3.interpolateRgb(USER_COLORS[1], USER_COLORS[0])(ratio)
      }

      // 3+ users: blend RGB based on proportions
      let r = 0, g = 0, b = 0
      const colors = usernames.map((_, i) => d3.rgb(USER_COLORS[i % USER_COLORS.length]))
      for (let i = 0; i < usernames.length; i++) {
        const weight = counts[i] / total
        r += colors[i].r * weight
        g += colors[i].g * weight
        b += colors[i].b * weight
      }
      return d3.rgb(r, g, b).formatHex()
    }

    // Brightness based on total count relative to max
    const maxTotal = d3.max(filtered, row =>
      usernames.reduce((sum, u) => sum + (row[u] as number), 0)
    ) ?? 1

    function getCellOpacity(row: HeatmapRow): number {
      const total = usernames.reduce((sum, u) => sum + (row[u] as number), 0)
      return 0.4 + 0.6 * (total / maxTotal)
    }

    // Render cells
    const leaves = root.leaves()

    const cell = svg.selectAll('g')
      .data(leaves)
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)

    // Territory rectangles with rounded corners
    cell.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('rx', 3)
      .attr('fill', d => getCellColor(d.data.row))
      .attr('opacity', d => getCellOpacity(d.data.row))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')

    // Tooltips
    cell.append('title')
      .text(d => {
        const row = d.data.row
        const lines = [`${row.song}`]
        for (const u of usernames) {
          lines.push(`  ${u}: ${row[u]} show${(row[u] as number) !== 1 ? 's' : ''}`)
        }
        return lines.join('\n')
      })

    // Song labels — only show if cell is large enough
    cell.each(function(d) {
      const w = d.x1 - d.x0
      const h = d.y1 - d.y0
      const g = d3.select(this)

      if (w < 40 || h < 16) return

      // Song name
      const fontSize = Math.min(12, Math.max(8, w / d.data.name.length * 1.4))
      g.append('text')
        .attr('x', 4)
        .attr('y', fontSize + 2)
        .style('font-size', `${fontSize}px`)
        .style('font-family', 'system-ui')
        .style('font-weight', '600')
        .style('fill', 'white')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
        .style('pointer-events', 'none')
        .text(d.data.name.length > w / (fontSize * 0.55) ? d.data.name.slice(0, Math.floor(w / (fontSize * 0.55))) + '…' : d.data.name)

      // Count per user (if room)
      if (h > 32) {
        const row = d.data.row
        const countText = usernames.map(u => `${row[u]}`).join(' / ')
        g.append('text')
          .attr('x', 4)
          .attr('y', fontSize + 16)
          .style('font-size', '9px')
          .style('font-family', 'system-ui')
          .style('fill', 'rgba(255,255,255,0.8)')
          .style('text-shadow', '0 1px 2px rgba(0,0,0,0.4)')
          .style('pointer-events', 'none')
          .text(countText)
      }
    })
  }, [usernames, matrix, minShows])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {usernames.map((u, i) => (
            <span key={u} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: USER_COLORS[i % USER_COLORS.length], display: 'inline-block' }} />
              {u}
            </span>
          ))}
        </div>
        <label style={{ fontSize: '0.85rem', color: '#666', marginLeft: 'auto' }}>
          Min shows:
          <input
            type="range"
            min={1}
            max={20}
            value={minShows}
            onChange={e => setMinShows(Number(e.target.value))}
            style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
          />
          <span style={{ marginLeft: '0.25rem' }}>{minShows}</span>
        </label>
      </div>
      <svg ref={svgRef} style={{ width: '100%', maxWidth: 1200 }} />
    </div>
  )
}
