import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

interface Props {
  warByYear: Record<number, number>
  width?: number
  height?: number
}

export default function WARSparkline({ warByYear, width = 80, height = 20 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const entries = Object.entries(warByYear)
      .map(([yr, war]) => ({ year: parseInt(yr), war }))
      .sort((a, b) => a.year - b.year)

    if (entries.length < 2) return

    const x = d3.scaleLinear()
      .domain(d3.extent(entries, d => d.year) as [number, number])
      .range([2, width - 2])

    const yExtent = d3.extent(entries, d => d.war) as [number, number]
    const yPad = Math.max(0.1, (yExtent[1] - yExtent[0]) * 0.1)
    const y = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([height - 2, 2])

    const line = d3.line<{ year: number; war: number }>()
      .x(d => x(d.year))
      .y(d => y(d.war))

    // Zero line
    if (yExtent[0] < 0) {
      svg.append('line')
        .attr('x1', 2).attr('x2', width - 2)
        .attr('y1', y(0)).attr('y2', y(0))
        .attr('stroke', '#ddd').attr('stroke-width', 0.5)
    }

    // Area fill
    const area = d3.area<{ year: number; war: number }>()
      .x(d => x(d.year))
      .y0(y(0))
      .y1(d => y(d.war))

    svg.append('path')
      .datum(entries)
      .attr('d', area)
      .attr('fill', entries[entries.length - 1].war >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)')

    // Line
    svg.append('path')
      .datum(entries)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', entries[entries.length - 1].war >= 0 ? '#22c55e' : '#ef4444')
      .attr('stroke-width', 1.5)

    // End dot
    const last = entries[entries.length - 1]
    svg.append('circle')
      .attr('cx', x(last.year))
      .attr('cy', y(last.war))
      .attr('r', 2)
      .attr('fill', last.war >= 0 ? '#22c55e' : '#ef4444')
  }, [warByYear, width, height])

  return <svg ref={svgRef} width={width} height={height} style={{ verticalAlign: 'middle' }} />
}
