import { useState, useEffect } from 'react'
import SongDeepDive from './SongDeepDive'
import SongDeepDiveMobile from './SongDeepDiveMobile'
import * as dataSource from '../api/data-source'
import { getParam, setParams } from '../url-params'

function App() {
  const [jamYear, setJamYear] = useState(() => getParam('year') || '')
  const [jamYears, setJamYears] = useState<number[]>([])
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Sync year to URL
  useEffect(() => {
    if (jamYear) {
      setParams({ year: jamYear === 'all' ? null : jamYear })
    }
  }, [jamYear])

  // Fetch available years on mount, pick random year if none specified
  useEffect(() => {
    dataSource.fetchJamchartYears()
      .then(years => {
        // Filter out 2020 (COVID, no shows)
        const filteredYears = years.filter(y => y !== 2020)
        setJamYears(filteredYears)

        // If no year in URL, pick a random one for variety
        if (!getParam('year') && filteredYears.length > 0) {
          // Don't default to 2026 until after May 1st, 2026
          const now = new Date()
          const may2026 = new Date(2026, 4, 1) // May 1st, 2026
          const eligibleYears = now < may2026
            ? filteredYears.filter(y => y !== 2026)
            : filteredYears

          const randomYear = eligibleYears[Math.floor(Math.random() * eligibleYears.length)]
          setJamYear(String(randomYear))
        } else if (!jamYear) {
          setJamYear('all')
        }
      })
      .catch(() => setJamYear('all'))
  }, [])

  // Don't render until year is determined
  if (!jamYear) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui', textAlign: 'center', color: '#64748b' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? '0' : '2rem', fontFamily: 'system-ui', maxWidth: '1400px', margin: '0 auto' }}>
      {isMobile ? (
        <SongDeepDiveMobile year={jamYear} years={jamYears} onYearChange={setJamYear} />
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <h1 style={{ margin: 0 }}>
              Phish 3.0 Jamchart Analysis
              <a
                href="#/phangraphs"
                style={{
                  marginLeft: '1rem', padding: '0.3rem 0.8rem', fontSize: '0.75rem',
                  border: '1px solid #ef4444', borderRadius: '4px',
                  color: '#ef4444', textDecoration: 'none', verticalAlign: 'middle',
                }}
              >
                PhanGraphs
              </a>
            </h1>
            <label style={{ fontSize: '0.85rem', color: '#666' }}>
              Year:
              <select
                value={jamYear}
                onChange={e => setJamYear(e.target.value)}
                style={{ marginLeft: '0.5rem', padding: '0.3rem', fontSize: '0.85rem' }}
              >
                <option value="all">All Time (3.0)</option>
                {jamYears.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            {jamYear === 'all' ? 'All Phish 3.0 shows (2009\u2013present)' : `Shows from ${jamYear}`}
          </p>
          <SongDeepDive year={jamYear} />
        </div>
      )}
    </div>
  )
}

export default App
