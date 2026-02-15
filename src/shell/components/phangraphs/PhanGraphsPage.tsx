import { usePhanGraphs } from '../../hooks/usePhanGraphs'
import WARSparkline from './WARSparkline'
import type { AggregatedLeaderboardEntry, PhanGraphsFilter, RunPositionFilter } from '../../../core/phangraphs/types'

type SortColumn = 'war' | 'warPerPlay' | 'warPerShow' | 'avgJIS' | 'peakJIS' | 'timesPlayed' | 'jamRate' | 'jamchartCount'

const SORT_COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'war', label: 'Career WAR' },
  { key: 'warPerPlay', label: 'WAR/Play' },
  { key: 'warPerShow', label: 'WAR/Show' },
  { key: 'avgJIS', label: 'Avg JIS' },
  { key: 'peakJIS', label: 'Peak JIS' },
  { key: 'timesPlayed', label: 'Times Played' },
  { key: 'jamRate', label: 'Jam Rate' },
  { key: 'jamchartCount', label: 'JC Count' },
]

function getSortValue(entry: AggregatedLeaderboardEntry, col: SortColumn): number {
  switch (col) {
    case 'war': return entry.war.careerWAR
    case 'warPerPlay': return entry.war.warPerPlay
    case 'warPerShow': return entry.war.warPerShow
    case 'avgJIS': return entry.jis.avgJIS
    case 'peakJIS': return entry.jis.peakJIS
    case 'timesPlayed': return entry.counting.timesPlayed
    case 'jamRate': return entry.rates.jamRate
    case 'jamchartCount': return entry.counting.jamchartCount
  }
}

function warColor(war: number, maxWar: number): string {
  if (maxWar <= 0) return '#f5f5f5'
  const ratio = Math.max(0, Math.min(1, war / maxWar))
  const r = Math.round(239 + (34 - 239) * ratio)
  const g = Math.round(246 + (197 - 246) * ratio)
  const b = Math.round(239 + (94 - 239) * ratio)
  return `rgb(${r},${g},${b})`
}

function entryKey(entry: AggregatedLeaderboardEntry): string {
  const k = entry.aggregationKey
  return `${k.songName}-${k.year ?? ''}-${k.tourId ?? ''}`
}

function PhanGraphsPage() {
  const { entries, filter, setFilter, loading, sortCol, setSortCol, sortDir, setSortDir, availableVenues, availableStates } = usePhanGraphs()

  const isAggregated = filter.aggregation !== 'career'

  const sorted = [...entries].sort((a, b) => {
    const va = getSortValue(a, sortCol)
    const vb = getSortValue(b, sortCol)
    return sortDir === 'desc' ? vb - va : va - vb
  })

  const maxWar = sorted.length > 0 ? Math.max(...sorted.map(e => e.war.careerWAR)) : 0

  function handleSort(col: SortColumn) {
    if (col === sortCol) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2009 + 1 }, (_, i) => 2009 + i)

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>
          PhanGraphs
          <span style={{ fontSize: '0.5em', color: '#888', marginLeft: '0.5rem', fontWeight: 400 }}>
            Song Sabermetrics
          </span>
        </h1>
        <a href={import.meta.env.BASE_URL || '/'} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>
          Back to phstats
        </a>
      </div>

      {/* Row 1: Year range + Aggregation + Set */}
      <div style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
        padding: '1rem', background: '#f9fafb', borderRadius: '8px 8px 0 0', borderBottom: '1px solid #eee',
        fontSize: '0.85rem',
      }}>
        <label>
          Years:
          <select value={filter.yearStart} onChange={e => setFilter({ ...filter, yearStart: parseInt(e.target.value) })} style={selectStyle}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ margin: '0 0.25rem' }}>-</span>
          <select value={filter.yearEnd} onChange={e => setFilter({ ...filter, yearEnd: parseInt(e.target.value) })} style={selectStyle}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label>
          View:
          <select value={filter.aggregation} onChange={e => setFilter({ ...filter, aggregation: e.target.value as PhanGraphsFilter['aggregation'] })} style={selectStyle}>
            <option value="career">Career</option>
            <option value="byYear">By Year</option>
            <option value="byTour">By Tour</option>
          </select>
        </label>
        <label>
          Set:
          <select value={filter.setSplit} onChange={e => setFilter({ ...filter, setSplit: e.target.value as PhanGraphsFilter['setSplit'] })} style={selectStyle}>
            <option value="all">All</option>
            <option value="set1">Set 1</option>
            <option value="set2">Set 2</option>
            <option value="set3">Set 3</option>
            <option value="encore">Encore</option>
            <option value="opener">Openers</option>
            <option value="closer">Closers</option>
          </select>
        </label>
      </div>

      {/* Row 2: Venue, State, Country, Run Position */}
      <div style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
        padding: '1rem', background: '#f9fafb', borderBottom: '1px solid #eee',
        fontSize: '0.85rem',
      }}>
        <label>
          Venue:
          <select value={filter.venue ?? ''} onChange={e => setFilter({ ...filter, venue: e.target.value || null })} style={selectStyle}>
            <option value="">All</option>
            {availableVenues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          State:
          <select value={filter.state ?? ''} onChange={e => setFilter({ ...filter, state: e.target.value || null })} style={selectStyle}>
            <option value="">All</option>
            {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Country:
          <select value={filter.country} onChange={e => setFilter({ ...filter, country: e.target.value as PhanGraphsFilter['country'] })} style={selectStyle}>
            <option value="all">All</option>
            <option value="us">US</option>
            <option value="international">International</option>
          </select>
        </label>
        <label>
          Run #:
          <select value={filter.runPosition} onChange={e => setFilter({ ...filter, runPosition: e.target.value as RunPositionFilter })} style={selectStyle}>
            <option value="all">All</option>
            <option value="opener">Run Opener</option>
            <option value="n1">N1</option>
            <option value="n2">N2</option>
            <option value="n3">N3</option>
            <option value="n4">N4</option>
            <option value="n5">N5</option>
            <option value="closer">Run Closer</option>
          </select>
        </label>
      </div>

      {/* Row 3: Qualification thresholds */}
      <div style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
        padding: '1rem', background: '#f9fafb', borderRadius: '0 0 8px 8px', marginBottom: '1.5rem',
        fontSize: '0.85rem',
      }}>
        <label>
          Min plays:
          <input type="number" value={filter.minTimesPlayed} min={0} onChange={e => setFilter({ ...filter, minTimesPlayed: parseInt(e.target.value) || 0 })} style={inputStyle} />
        </label>
        <label>
          Min shows:
          <input type="number" value={filter.minShowsAppeared} min={0} onChange={e => setFilter({ ...filter, minShowsAppeared: parseInt(e.target.value) || 0 })} style={inputStyle} />
        </label>
        <label>
          Min JC:
          <input type="number" value={filter.minJamchartCount} min={0} onChange={e => setFilter({ ...filter, minJamchartCount: parseInt(e.target.value) || 0 })} style={inputStyle} />
        </label>
      </div>

      {loading && <p style={{ color: '#888' }}>Computing leaderboard...</p>}

      {!loading && sorted.length === 0 && (
        <p style={{ color: '#888' }}>No songs match the current filters.</p>
      )}

      {!loading && sorted.length > 0 && (
        <>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {sorted.length} {isAggregated ? 'rows' : 'songs'} qualified
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: '140px' }}>Song</th>
                  {isAggregated && (
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '100px' }}>
                      {filter.aggregation === 'byYear' ? 'Year' : 'Tour'}
                    </th>
                  )}
                  {SORT_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {sortCol === col.key && (sortDir === 'desc' ? ' \u25BC' : ' \u25B2')}
                    </th>
                  ))}
                  <th style={thStyle}>JIS Vol</th>
                  <th style={thStyle}>Peak Year</th>
                  {!isAggregated && <th style={thStyle}>WAR Trend</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr key={entryKey(entry)} style={{ background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>{entry.songName}</td>
                    {isAggregated && (
                      <td style={{ ...tdStyle, textAlign: 'left', color: '#666', fontSize: '0.8rem' }}>
                        {entry.aggregationKey.year ?? entry.aggregationKey.tourLabel ?? ''}
                      </td>
                    )}
                    <td style={{ ...tdStyle, background: warColor(entry.war.careerWAR, maxWar), fontWeight: 600 }}>
                      {entry.war.careerWAR.toFixed(1)}
                    </td>
                    <td style={tdStyle}>{entry.war.warPerPlay.toFixed(2)}</td>
                    <td style={tdStyle}>{entry.war.warPerShow.toFixed(2)}</td>
                    <td style={tdStyle}>{entry.jis.avgJIS.toFixed(1)}</td>
                    <td style={tdStyle}>{entry.jis.peakJIS.toFixed(1)}</td>
                    <td style={tdStyle}>{entry.counting.timesPlayed}</td>
                    <td style={tdStyle}>{(entry.rates.jamRate * 100).toFixed(0)}%</td>
                    <td style={tdStyle}>{entry.counting.jamchartCount}</td>
                    <td style={tdStyle}>{entry.jis.jisVolatility.toFixed(2)}</td>
                    <td style={tdStyle}>{entry.war.peakWARYear || '-'}</td>
                    {!isAggregated && (
                      <td style={tdStyle}>
                        <WARSparkline warByYear={entry.war.warByYear} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  marginLeft: '0.25rem', padding: '0.3rem', fontSize: '0.85rem',
}

const inputStyle: React.CSSProperties = {
  marginLeft: '0.25rem', padding: '0.3rem', fontSize: '0.85rem', width: '50px',
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.4rem',
  borderBottom: '2px solid #ddd',
  textAlign: 'center',
  fontSize: '0.8rem',
  color: '#666',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '0.35rem 0.4rem',
  borderBottom: '1px solid #eee',
  textAlign: 'center',
  fontSize: '0.85rem',
}

export default PhanGraphsPage
