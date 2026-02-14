import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

interface HeatmapRow {
  song: string
  [username: string]: string | number
}

interface Props {
  usernames: string[]
  matrix: HeatmapRow[]
}

const CELL_SIZE = 18
const LABEL_WIDTH = 220
const USER_HEADER_HEIGHT = 80

export default function SongHeatmap({ usernames, matrix }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || matrix.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = LABEL_WIDTH + usernames.length * CELL_SIZE + 20
    const height = USER_HEADER_HEIGHT + matrix.length * CELL_SIZE + 20

    svg.attr('width', width).attr('height', height)

    // Find max count for color scale
    let maxCount = 0
    for (const row of matrix) {
      for (const u of usernames) {
        const v = row[u] as number
        if (v > maxCount) maxCount = v
      }
    }

    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCount || 1])

    const g = svg.append('g').attr('transform', `translate(${LABEL_WIDTH}, ${USER_HEADER_HEIGHT})`)

    // User labels (rotated at top)
    usernames.forEach((u, i) => {
      g.append('text')
        .attr('x', i * CELL_SIZE + CELL_SIZE / 2)
        .attr('y', -8)
        .attr('text-anchor', 'start')
        .attr('transform', `rotate(-45, ${i * CELL_SIZE + CELL_SIZE / 2}, -8)`)
        .style('font-size', '11px')
        .style('font-family', 'system-ui')
        .text(u)
    })

    // Song labels (left side)
    matrix.forEach((row, i) => {
      g.append('text')
        .attr('x', -6)
        .attr('y', i * CELL_SIZE + CELL_SIZE / 2 + 4)
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('font-family', 'system-ui')
        .text(row.song)
    })

    // Cells
    matrix.forEach((row, rowIdx) => {
      usernames.forEach((u, colIdx) => {
        const val = row[u] as number
        const cell = g.append('g')

        cell.append('rect')
          .attr('x', colIdx * CELL_SIZE)
          .attr('y', rowIdx * CELL_SIZE)
          .attr('width', CELL_SIZE - 1)
          .attr('height', CELL_SIZE - 1)
          .attr('rx', 2)
          .attr('fill', val === 0 ? '#f0f0f0' : color(val))
          .style('cursor', 'pointer')

        cell.append('title')
          .text(`${row.song} — ${u}: ${val} show${val !== 1 ? 's' : ''}`)

        if (val > 0 && CELL_SIZE >= 16) {
          cell.append('text')
            .attr('x', colIdx * CELL_SIZE + CELL_SIZE / 2 - 0.5)
            .attr('y', rowIdx * CELL_SIZE + CELL_SIZE / 2 + 3.5)
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('font-family', 'system-ui')
            .style('fill', val > maxCount * 0.6 ? 'white' : '#333')
            .style('pointer-events', 'none')
            .text(val)
        }
      })
    })
  }, [usernames, matrix])

  return <svg ref={svgRef} />
}
