import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

interface UserSummary {
  username: string
  totalShows: number
  uniqueSongs: number
  statesVisited: string[]
  venuesVisited: string[]
  totalPerformances: number
}

interface Props {
  userSummaries: UserSummary[]
}

const USER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c']

const DIMENSIONS = [
  { key: 'totalShows', label: 'Shows' },
  { key: 'uniqueSongs', label: 'Unique Songs' },
  { key: 'states', label: 'States' },
  { key: 'venues', label: 'Venues' },
  { key: 'totalPerformances', label: 'Songs Heard' },
]

export default function RadarChart({ userSummaries }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || userSummaries.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 600
    const height = 600
    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(cx, cy) - 80

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    // Normalize values per dimension (0-1 scale relative to max across users)
    const normData = userSummaries.map(u => {
      return {
        username: u.username,
        values: DIMENSIONS.map(dim => {
          switch (dim.key) {
            case 'totalShows': return u.totalShows
            case 'uniqueSongs': return u.uniqueSongs
            case 'states': return u.statesVisited.length
            case 'venues': return u.venuesVisited.length
            case 'totalPerformances': return u.totalPerformances
            default: return 0
          }
        }),
      }
    })

    // Max per dimension
    const maxPerDim = DIMENSIONS.map((_, i) =>
      d3.max(normData, d => d.values[i]) ?? 1
    )

    const angleSlice = (2 * Math.PI) / DIMENSIONS.length

    // Background rings
    const levels = 5
    for (let l = 1; l <= levels; l++) {
      const r = (radius / levels) * l
      svg.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', r)
        .attr('fill', 'none').attr('stroke', '#e5e7eb')
        .attr('stroke-width', l === levels ? 1.5 : 0.8)
    }

    // Axes
    DIMENSIONS.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2
      const x2 = cx + radius * Math.cos(angle)
      const y2 = cy + radius * Math.sin(angle)

      svg.append('line')
        .attr('x1', cx).attr('y1', cy)
        .attr('x2', x2).attr('y2', y2)
        .attr('stroke', '#ddd').attr('stroke-width', 1)

      // Label
      const labelR = radius + 30
      const lx = cx + labelR * Math.cos(angle)
      const ly = cy + labelR * Math.sin(angle)

      svg.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '12px').style('fill', '#555').style('font-weight', '600')
        .text(dim.label)
    })

    // Draw polygons per user
    normData.forEach((userData, ui) => {
      const points = userData.values.map((val, i) => {
        const normalized = val / maxPerDim[i]
        const angle = angleSlice * i - Math.PI / 2
        return {
          x: cx + radius * normalized * Math.cos(angle),
          y: cy + radius * normalized * Math.sin(angle),
        }
      })

      const color = USER_COLORS[ui % USER_COLORS.length]

      // Filled polygon
      const lineGen = d3.line<{ x: number; y: number }>()
        .x(d => d.x).y(d => d.y)
        .curve(d3.curveLinearClosed)

      svg.append('path')
        .datum(points)
        .attr('d', lineGen)
        .attr('fill', color)
        .attr('fill-opacity', 0.12)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.8)

      // Dots at vertices
      points.forEach((p, i) => {
        svg.append('circle')
          .attr('cx', p.x).attr('cy', p.y).attr('r', 4)
          .attr('fill', color).attr('stroke', '#fff').attr('stroke-width', 1.5)

        // Value label
        const angle = angleSlice * i - Math.PI / 2
        const labelR = radius * (userData.values[i] / maxPerDim[i]) + 14
        svg.append('text')
          .attr('x', cx + labelR * Math.cos(angle))
          .attr('y', cy + labelR * Math.sin(angle))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('font-size', '10px').style('fill', color).style('font-weight', '600')
          .text(userData.values[i])
      })
    })

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 180}, 20)`)

    userSummaries.forEach((u, i) => {
      const g = legend.append('g').attr('transform', `translate(0, ${i * 22})`)
      g.append('rect').attr('width', 14).attr('height', 14).attr('rx', 3)
        .attr('fill', USER_COLORS[i % USER_COLORS.length])
      g.append('text').attr('x', 20).attr('y', 11)
        .style('font-size', '12px').style('fill', '#444').text(u.username)
    })
  }, [userSummaries])

  return <svg ref={svgRef} style={{ width: '100%', maxWidth: 600, margin: '0 auto', display: 'block' }} />
}
