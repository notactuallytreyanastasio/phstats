import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

interface PositionData {
  set_label: string
  position: number
  total: number
  jamcharts: number
}

interface Props {
  data: PositionData[]
}

export default function JamchartPositionMap({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Filter to reasonable set labels and positions
    const setOrder = ['Set 1', 'Set 2', 'Set 3', 'Encore']
    const filtered = data.filter(d => setOrder.includes(d.set_label) && d.position <= 14)

    const sets = setOrder.filter(s => filtered.some(d => d.set_label === s))
    const maxPos = d3.max(filtered, d => d.position) ?? 14
    const positions = Array.from({ length: maxPos }, (_, i) => i + 1)

    const margin = { top: 50, right: 40, bottom: 60, left: 80 }
    const cellW = 55
    const cellH = 50
    const width = margin.left + margin.right + positions.length * cellW
    const height = margin.top + margin.bottom + sets.length * cellH

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    const x = d3.scaleBand().domain(positions.map(String)).range([margin.left, width - margin.right]).padding(0.08)
    const y = d3.scaleBand().domain(sets).range([margin.top, height - margin.bottom]).padding(0.08)

    // Build a lookup
    const lookup = new Map<string, PositionData>()
    for (const d of filtered) {
      lookup.set(`${d.set_label}|${d.position}`, d)
    }

    const maxJamcharts = d3.max(filtered, d => d.jamcharts) ?? 1
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxJamcharts])

    // Column labels (position)
    svg.selectAll('.col-label')
      .data(positions)
      .join('text')
      .attr('class', 'col-label')
      .attr('x', d => x(String(d))! + x.bandwidth() / 2)
      .attr('y', margin.top - 8)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px').style('fill', '#666')
      .text(d => d)

    svg.append('text')
      .attr('x', (margin.left + width - margin.right) / 2)
      .attr('y', margin.top - 28)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px').style('fill', '#888').style('font-weight', '600')
      .text('Position in Set')

    // Row labels (set)
    svg.selectAll('.row-label')
      .data(sets)
      .join('text')
      .attr('class', 'row-label')
      .attr('x', margin.left - 8)
      .attr('y', d => y(d)! + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '12px').style('fill', '#444').style('font-weight', '600')
      .text(d => d)

    // Cells
    const cells: { set: string; pos: number; data: PositionData | undefined }[] = []
    for (const s of sets) {
      for (const p of positions) {
        cells.push({ set: s, pos: p, data: lookup.get(`${s}|${p}`) })
      }
    }

    svg.selectAll('.cell')
      .data(cells)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', d => x(String(d.pos))!)
      .attr('y', d => y(d.set)!)
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('fill', d => d.data && d.data.jamcharts > 0 ? color(d.data.jamcharts) : '#f5f5f5')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mousemove', (event: MouseEvent, d) => {
        if (!tooltipRef.current || !d.data) return
        const tip = tooltipRef.current
        const pct = d.data.total > 0 ? (100 * d.data.jamcharts / d.data.total).toFixed(1) : '0'
        tip.innerHTML = `<strong>${d.set}, Position ${d.pos}</strong><br/>`
          + `Total songs: ${d.data.total}<br/>`
          + `Jamcharts: <strong>${d.data.jamcharts}</strong> (${pct}%)`
        tip.style.display = 'block'
        tip.style.left = `${event.clientX + 12}px`
        tip.style.top = `${event.clientY - 10}px`
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // Jamchart count text in cells
    svg.selectAll('.cell-text')
      .data(cells.filter(d => d.data && d.data.jamcharts > 0))
      .join('text')
      .attr('class', 'cell-text')
      .attr('x', d => x(String(d.pos))! + x.bandwidth() / 2)
      .attr('y', d => y(d.set)! + y.bandwidth() / 2 + 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '700')
      .style('fill', d => (d.data!.jamcharts > maxJamcharts * 0.5) ? '#fff' : '#444')
      .style('pointer-events', 'none')
      .text(d => d.data!.jamcharts)

    // Color legend
    const legendW = 200
    const legendH = 12
    const legendX = width - margin.right - legendW
    const legendY = height - 20

    const defs = svg.append('defs')
    const gradient = defs.append('linearGradient').attr('id', 'jam-legend')
    gradient.append('stop').attr('offset', '0%').attr('stop-color', color(0))
    gradient.append('stop').attr('offset', '100%').attr('stop-color', color(maxJamcharts))

    svg.append('rect')
      .attr('x', legendX).attr('y', legendY)
      .attr('width', legendW).attr('height', legendH)
      .attr('rx', 3)
      .style('fill', 'url(#jam-legend)')

    svg.append('text').attr('x', legendX).attr('y', legendY - 4)
      .style('font-size', '10px').style('fill', '#888').text('0')
    svg.append('text').attr('x', legendX + legendW).attr('y', legendY - 4)
      .attr('text-anchor', 'end')
      .style('font-size', '10px').style('fill', '#888').text(`${maxJamcharts} jamcharts`)
  }, [data])

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        Where in the show do jams happen? Hotter colors = more jamchart performances at that set position.
      </p>
      <svg ref={svgRef} style={{ width: '100%', maxWidth: 1000 }} />
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 300,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}
