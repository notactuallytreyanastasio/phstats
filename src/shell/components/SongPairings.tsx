import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import * as dataSource from '../api/data-source'
import { getParam, setParams } from '../url-params'

interface Pairing {
  song_a: string
  song_b: string
  co_occurrences: number
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function SongPairings({ year }: { year: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Pairing[]>([])
  const [minShows, setMinShows] = useState(() => {
    const m = getParam('pmin')
    return m ? parseInt(m) : 3
  })

  useEffect(() => {
    setParams({ pmin: minShows === 3 ? null : String(minShows) })
  }, [minShows])

  useEffect(() => {
    dataSource.fetchSongPairings(year, minShows).then(setData).catch(() => {})
  }, [year, minShows])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const top = data.slice(0, 40)

    // Build node set
    const nodeNames = new Set<string>()
    top.forEach(p => { nodeNames.add(p.song_a); nodeNames.add(p.song_b) })
    const nodes = [...nodeNames].map(name => ({ id: name }))
    const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))

    const links = top.map(p => ({
      source: nodeIndex.get(p.song_a)!,
      target: nodeIndex.get(p.song_b)!,
      value: p.co_occurrences,
    }))

    const width = 650
    const height = 500

    svg.attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)

    const maxVal = d3.max(links, d => d.value) ?? 1

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).distance(d => 120 - (d.value / maxVal) * 60))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))

    // Links
    const linkSel = svg.selectAll('.link')
      .data(links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', '#ddd')
      .attr('stroke-width', d => 1 + (d.value / maxVal) * 5)
      .attr('stroke-opacity', 0.6)

    // Node groups
    const nodeSel = svg.selectAll('.node')
      .data(nodes as any)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
        })
        .on('drag', (event) => {
          event.subject.fx = event.x
          event.subject.fy = event.y
        })
        .on('end', (event) => {
          if (!event.active) simulation.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
        })
      )

    // Count connections per node for sizing
    const connectionCount = new Map<string, number>()
    top.forEach(p => {
      connectionCount.set(p.song_a, (connectionCount.get(p.song_a) ?? 0) + p.co_occurrences)
      connectionCount.set(p.song_b, (connectionCount.get(p.song_b) ?? 0) + p.co_occurrences)
    })
    const maxConn = d3.max([...connectionCount.values()]) ?? 1

    nodeSel.append('circle')
      .attr('r', (d: any) => {
        const count = connectionCount.get(d.id) ?? 1
        return 6 + (count / maxConn) * 14
      })
      .attr('fill', (d: any) => {
        const count = connectionCount.get(d.id) ?? 0
        return d3.interpolateReds(0.2 + (count / maxConn) * 0.6)
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)

    nodeSel.append('text')
      .attr('dy', (d: any) => {
        const count = connectionCount.get(d.id) ?? 1
        return -(8 + (count / maxConn) * 14)
      })
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('fill', '#555')
      .text((d: any) => d.id.length > 18 ? d.id.slice(0, 16) + '…' : d.id)

    // Tooltips
    nodeSel.on('mousemove', (event: MouseEvent, d: any) => {
      if (!tooltipRef.current) return
      const tip = tooltipRef.current
      const pairings = top
        .filter(p => p.song_a === d.id || p.song_b === d.id)
        .slice(0, 8)
        .map(p => {
          const other = p.song_a === d.id ? p.song_b : p.song_a
          return `${esc(other)}: ${p.co_occurrences} shows`
        })
      tip.innerHTML = [
        `<strong>${esc(d.id)}</strong>`,
        ``,
        ...pairings,
      ].join('<br/>')
      tip.style.display = 'block'
      tip.style.left = `${event.clientX + 12}px`
      tip.style.top = `${event.clientY - 10}px`
    })
    .on('mouseleave', () => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none'
    })

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => { simulation.stop() }
  }, [data])

  return (
    <div style={{ position: 'relative' }}>
      <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
        Songs that get jammed together in the same show. Thicker lines = more co-occurrences. Drag nodes to rearrange.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem' }}>
          Min shows together:
          <input
            type="range"
            min={1}
            max={10}
            value={minShows}
            onChange={e => setMinShows(parseInt(e.target.value))}
            style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
          />
          <span style={{ marginLeft: '0.3rem', fontWeight: 600 }}>{minShows}</span>
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} style={{ width: '100%' }} />
      </div>
      {data.length === 0 && (
        <p style={{ color: '#aaa', textAlign: 'center', marginTop: '1rem' }}>
          No pairings found. Try lowering the minimum shows threshold.
        </p>
      )}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'fixed', background: 'rgba(0,0,0,0.88)',
        color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
        lineHeight: '1.5', pointerEvents: 'none', zIndex: 1000, maxWidth: 320,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}
