import { useRef, useEffect } from 'react'
import * as d3 from 'd3'

interface ShowRecord {
  username: string
  date: string
}

interface Props {
  allShows: ShowRecord[]
  allUsernames: string[]
}

const USER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c']

export default function YearCompare({ allShows, allUsernames }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || allShows.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Build year x user data
    const yearMap = new Map<number, Map<string, number>>()
    for (const s of allShows) {
      const year = parseInt(s.date.slice(0, 4), 10)
      if (!yearMap.has(year)) yearMap.set(year, new Map())
      const userCounts = yearMap.get(year)!
      userCounts.set(s.username, (userCounts.get(s.username) ?? 0) + 1)
    }

    const years = [...yearMap.keys()].sort()
    const data = years.map(year => {
      const counts = yearMap.get(year)!
      const entry: Record<string, number> = { year }
      for (const u of allUsernames) {
        entry[u] = counts.get(u) ?? 0
      }
      return entry
    })

    const margin = { top: 30, right: 30, bottom: 50, left: 50 }
    const width = 900
    const height = 400

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`)

    const x0 = d3.scaleBand()
      .domain(years.map(String))
      .range([margin.left, width - margin.right])
      .paddingInner(0.2)

    const x1 = d3.scaleBand()
      .domain(allUsernames)
      .range([0, x0.bandwidth()])
      .padding(0.05)

    const maxCount = d3.max(data, d => d3.max(allUsernames, u => d[u])) ?? 1
    const y = d3.scaleLinear()
      .domain([0, maxCount])
      .range([height - margin.bottom, margin.top])
      .nice()

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x0))
      .selectAll('text').style('font-size', '11px')
      .attr('transform', 'rotate(-45)').attr('text-anchor', 'end')

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(8))
      .selectAll('text').style('font-size', '11px')

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', 14)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px').style('fill', '#666')
      .text('Shows')

    // Bars
    const yearGroups = svg.selectAll('.year-group')
      .data(data)
      .join('g')
      .attr('class', 'year-group')
      .attr('transform', d => `translate(${x0(String(d.year))},0)`)

    yearGroups.selectAll('rect')
      .data(d => allUsernames.map(u => ({ username: u, count: d[u], year: d.year })))
      .join('rect')
      .attr('x', d => x1(d.username)!)
      .attr('y', d => y(d.count))
      .attr('width', x1.bandwidth())
      .attr('height', d => y(0) - y(d.count))
      .attr('fill', d => USER_COLORS[allUsernames.indexOf(d.username) % USER_COLORS.length])
      .attr('opacity', 0.85)
      .attr('rx', 2)

    // Count labels on bars
    yearGroups.selectAll('.bar-label')
      .data(d => allUsernames.map(u => ({ username: u, count: d[u], year: d.year })))
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', d => x1(d.username)! + x1.bandwidth() / 2)
      .attr('y', d => d.count > 0 ? y(d.count) - 3 : y(0))
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('fill', '#555')
      .text(d => d.count > 0 ? d.count : '')

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right - 200}, ${margin.top})`)

    allUsernames.forEach((u, i) => {
      const g = legend.append('g').attr('transform', `translate(0, ${i * 20})`)
      g.append('rect').attr('width', 14).attr('height', 14).attr('rx', 3)
        .attr('fill', USER_COLORS[i % USER_COLORS.length])
      g.append('text').attr('x', 20).attr('y', 11)
        .style('font-size', '12px').style('fill', '#444').text(u)
    })
  }, [allShows, allUsernames.join(',')])

  return <svg ref={svgRef} style={{ width: '100%', maxWidth: 900 }} />
}
