import { useState, useEffect, useCallback } from 'react'

interface Stats {
  username: string
  totalShows: number
  totalPerformances: number
  uniqueSongs: number
  statesVisited: string[]
  venuesVisited: string[]
  firstShow: string | null
  lastShow: string | null
}

interface TopSong {
  song_name: string
  count: number
  jamchart_count: number
}

interface YearStat {
  year: number
  show_count: number
  unique_venues: number
  unique_songs: number
}

function App() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [topSongs, setTopSongs] = useState<TopSong[]>([])
  const [yearStats, setYearStats] = useState<YearStat[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, songsRes, yearsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/top-songs'),
        fetch('/api/year-stats'),
      ])

      if (statsRes.status === 503) {
        const body = await statsRes.json()
        setError(body.error)
        return
      }

      setStats(await statsRes.json())
      setTopSongs(await songsRes.json())
      setYearStats(await yearsRes.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Phish Stats</h1>
        <p style={{ color: '#666' }}>{error}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Phish Stats</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>Phish Stats — {stats.username}</h1>
        <button onClick={fetchData} style={{ padding: '0.4rem 1rem', cursor: 'pointer' }}>Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Shows" value={stats.totalShows} />
        <StatCard label="Songs Heard" value={stats.totalPerformances} />
        <StatCard label="Unique Songs" value={stats.uniqueSongs} />
        <StatCard label="States" value={stats.statesVisited.length} />
        <StatCard label="Venues" value={stats.venuesVisited.length} />
        <StatCard label="First Show" value={stats.firstShow ?? '—'} />
        <StatCard label="Last Show" value={stats.lastShow ?? '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h2>Top Songs</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Song</th>
                <th style={thStyle}>Times</th>
              </tr>
            </thead>
            <tbody>
              {topSongs.slice(0, 25).map((s, i) => (
                <tr key={s.song_name} style={{ background: i % 2 === 0 ? '#f9f9f9' : 'white' }}>
                  <td style={tdStyle}>{i + 1}</td>
                  <td style={{ ...tdStyle, textAlign: 'left' }}>{s.song_name}</td>
                  <td style={tdStyle}>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2>Shows by Year</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Year</th>
                <th style={thStyle}>Shows</th>
                <th style={thStyle}>Venues</th>
                <th style={thStyle}>Songs</th>
              </tr>
            </thead>
            <tbody>
              {yearStats.map((y, i) => (
                <tr key={y.year} style={{ background: i % 2 === 0 ? '#f9f9f9' : 'white' }}>
                  <td style={tdStyle}>{y.year}</td>
                  <td style={tdStyle}>{y.show_count}</td>
                  <td style={tdStyle}>{y.unique_venues}</td>
                  <td style={tdStyle}>{y.unique_songs}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: '2rem' }}>States Visited</h2>
          <p style={{ color: '#444' }}>{stats.statesVisited.join(', ')}</p>

          <h2 style={{ marginTop: '2rem' }}>Venues</h2>
          <ul style={{ columns: 2, columnGap: '1rem', padding: 0, listStyle: 'none' }}>
            {stats.venuesVisited.map(v => (
              <li key={v} style={{ padding: '2px 0', fontSize: '0.9rem', color: '#444' }}>{v}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</div>
      <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderBottom: '2px solid #ddd',
  textAlign: 'center',
  fontSize: '0.85rem',
  color: '#666',
}

const tdStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid #eee',
  textAlign: 'center',
  fontSize: '0.9rem',
}

export default App
