import { useState, useEffect, useCallback } from 'react'
import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride'
import type { CallBackProps, Step } from 'react-joyride'
import SongHeatmap from './SongHeatmap'
import SongScatter from './SongScatter'
import ShowTimeline from './ShowTimeline'
import YearCompare from './YearCompare'
import RadarChart from './RadarChart'
import SongGaps from './SongGaps'
import JamVehicleScatter from './JamVehicleScatter'
import JamchartPositionMap from './JamchartPositionMap'
import JamchartRankings from './JamchartRankings'
import ShowHeatCalendar from './ShowHeatCalendar'
import VenueRankings from './VenueRankings'
import JamEvolution from './JamEvolution'
import SongPairings from './SongPairings'
import SongDeepDive from './SongDeepDive'
import * as dataSource from '../api/data-source'
import { getParam, setParams } from '../url-params'

const isPublic = import.meta.env.VITE_PUBLIC_MODE === 'true'
const TOUR_KEY = 'phstats-tour-seen'

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

interface User {
  username: string
  show_count: number
}

interface HeatmapRow {
  song: string
  [username: string]: string | number
}

interface CompareData {
  usernames: string[]
  songs: string[]
  matrix: HeatmapRow[]
}

interface ShowRecord {
  username: string
  date: string
  venue: string
  city: string
  state: string
}

interface JamSong {
  song_name: string
  total_shows: number
  jamchart_count: number
  jamchart_pct: number
}

interface JamPosition {
  set_label: string
  position: number
  total: number
  jamcharts: number
}

type VizTab = 'heatmap' | 'scatter' | 'timeline' | 'years' | 'radar' | 'gaps'
type JamTab = 'vehicles' | 'heat-calendar' | 'positions' | 'rankings' | 'deep-dive' | 'venue-rankings' | 'jam-evolution' | 'song-pairings'

const VIZ_TABS: { key: VizTab; label: string }[] = [
  { key: 'heatmap', label: 'Song Treemap' },
  { key: 'scatter', label: 'Taste Scatter' },
  { key: 'timeline', label: 'Show Timeline' },
  { key: 'years', label: 'Year Compare' },
  { key: 'radar', label: 'Stat Radar' },
  { key: 'gaps', label: 'Song Gaps' },
]

const JAM_TABS: { key: JamTab; label: string }[] = [
  { key: 'vehicles', label: 'Jam Vehicles' },
  { key: 'heat-calendar', label: 'Show Heat' },
  { key: 'venue-rankings', label: 'Venue Power' },
  { key: 'jam-evolution', label: 'Jam Evolution' },
  { key: 'song-pairings', label: 'Song Pairings' },
  { key: 'positions', label: 'Set Positions' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'deep-dive', label: 'Song Deep Dive' },
]

const VALID_JAM_TABS = new Set<JamTab>(['vehicles', 'heat-calendar', 'positions', 'rankings', 'deep-dive', 'venue-rankings', 'jam-evolution', 'song-pairings'])

function initTab(): JamTab {
  const t = getParam('tab')
  return t && VALID_JAM_TABS.has(t as JamTab) ? t as JamTab : 'vehicles'
}

function App() {
  const [activeUser, setActiveUser] = useState('someguyorwhatever')
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [topSongs, setTopSongs] = useState<TopSong[]>([])
  const [yearStats, setYearStats] = useState<YearStat[]>([])
  const [compareData, setCompareData] = useState<CompareData | null>(null)
  const [allShows, setAllShows] = useState<ShowRecord[]>([])
  const [allStats, setAllStats] = useState<Stats[]>([])
  const [activeViz, setActiveViz] = useState<VizTab>('heatmap')
  const [activeJam, setActiveJam] = useState<JamTab>(initTab)
  const [jamSongs, setJamSongs] = useState<JamSong[]>([])
  const [jamPositions, setJamPositions] = useState<JamPosition[]>([])
  const [jamYear, setJamYear] = useState(() => getParam('year') || 'all')
  const [jamYears, setJamYears] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [runTour, setRunTour] = useState(false)

  // Sync App-level state to URL params, clean up child params on tab change
  useEffect(() => {
    const updates: Record<string, string | null> = {
      tab: activeJam === 'vehicles' ? null : activeJam,
      year: jamYear === 'all' ? null : jamYear,
    }
    // Clear deep-dive params when not on that tab
    if (activeJam !== 'deep-dive') {
      updates.song = null
      updates.sort = null
      updates.min = null
    }
    // Clear heat-calendar params when not on that tab
    if (activeJam !== 'heat-calendar') {
      updates.color = null
    }
    // Clear song-pairings params when not on that tab
    if (activeJam !== 'song-pairings') {
      updates.pmin = null
    }
    setParams(updates)
  }, [activeJam, jamYear])

  // Start tour for first-time visitors once jamchart data loads
  // Skip if they arrived via a shared link (has URL params)
  useEffect(() => {
    if (jamSongs.length === 0) return
    if (localStorage.getItem(TOUR_KEY)) return
    if (window.location.search) return // arrived via shared link, skip tour
    const t = setTimeout(() => setRunTour(true), 800)
    return () => clearTimeout(t)
  }, [jamSongs.length])

  const tourSteps: Step[] = [
    {
      target: '[data-tour="jamchart-section"]',
      title: 'Welcome to phstats!',
      content: 'This is a deep dive into Phish 3.0 jamchart data — every show from 2009 to now. Let\'s take a quick tour of what you can do here.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="year-picker"]',
      title: 'Slice by Year',
      content: 'Use the year picker to filter everything to a single year. All the charts, rankings, and song lists will update to show just that year\'s data. Pick "All Time" to see the full 3.0 era.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-vehicles"]',
      title: 'Jam Vehicles',
      content: 'Bubble chart showing which songs get jammed the most. X axis = times played, Y axis = jamchart %, bubble size = total jamcharts. Hover any bubble for details.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-heat-calendar"]',
      title: 'Show Heat Calendar',
      content: 'GitHub-style heatmap of every Phish 3.0 show. Each cell is a show date — darker red = more jamcharts that night. Instantly see which tours and runs were on fire. Color by jamchart count, rate, or total jam time.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-venue-rankings"]',
      title: 'Venue Jam Power',
      content: 'Horizontal bar chart of venues ranked by total jamchart entries. See which venues inspire the most jams — darker bars = higher jam rate.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-jam-evolution"]',
      title: 'Jam Evolution',
      content: 'Line chart showing how Phish\'s jamming has evolved year by year. Track jamcharts per show, total jamcharts, or average jam duration. Hover to see new "jam vehicles" each year.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-song-pairings"]',
      title: 'Song Pairings',
      content: 'Force-directed network graph of songs that get jammed together in the same show. Thicker lines = more co-occurrences. Drag nodes around to explore the connections.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-positions"]',
      title: 'Set Positions',
      content: 'Heatmap showing where in the setlist jams tend to land. Rows = sets, columns = slot position. Darker cells = more jamcharts in that spot.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-rankings"]',
      title: 'Rankings',
      content: 'Horizontal bar chart ranking songs by jamchart count. Sort and limit controls let you zoom in on the top contenders.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="tab-deep-dive"]',
      title: 'Song Deep Dive',
      content: 'The main event. Pick any song and see its full performance history as a duration timeline. Jamchart versions get red dots with stars. Hover for venue, jam notes, and more.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="deep-dive-controls"]',
      title: 'Slice & Dice',
      content: 'Filter songs by name, set a minimum times-played threshold, and sort by batting average (jamcharts / times played), jamchart count, or times played. The dropdown shows all the stats for each song.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="deep-dive-chart"]',
      title: 'The Chart',
      content: 'Duration timeline for the selected song. Hover any dot for venue, date, set position, likes, and jam notes. The red starred dots are the jamchart selections. Doink around!',
      placement: 'top',
    },
  ]

  // Map step indices to the tab that should be active when that step shows
  const stepTabMap: Record<number, JamTab> = {
    2: 'vehicles',
    3: 'heat-calendar',
    4: 'venue-rankings',
    5: 'jam-evolution',
    6: 'song-pairings',
    7: 'positions',
    8: 'rankings',
    9: 'deep-dive',
    10: 'deep-dive',
    11: 'deep-dive',
  }

  function handleTourCallback(data: CallBackProps) {
    const { status, action, index, type } = data

    // Switch to the right tab when stepping forward/back
    if (type === EVENTS.STEP_AFTER || type === EVENTS.STEP_BEFORE) {
      const nextIndex = action === ACTIONS.PREV ? index - 1 : index + 1
      if (nextIndex in stepTabMap) {
        setActiveJam(stepTabMap[nextIndex])
      }
    }

    // Tour finished or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false)
      localStorage.setItem(TOUR_KEY, 'true')
    }
  }

  // Fetch user list (skip in public mode)
  useEffect(() => {
    if (isPublic) return
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => {})
  }, [])

  // Fetch stats for active user (skip in public mode)
  const fetchData = useCallback(async () => {
    if (isPublic) return
    try {
      const [statsRes, songsRes, yearsRes] = await Promise.all([
        fetch(`/api/stats?username=${activeUser}`),
        fetch(`/api/top-songs?username=${activeUser}`),
        fetch(`/api/year-stats?username=${activeUser}`),
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
  }, [activeUser])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch available jamchart years on mount
  useEffect(() => {
    dataSource.fetchJamchartYears()
      .then(setJamYears)
      .catch(() => {})
  }, [])

  // Fetch jamchart data (not user-specific), re-fetch when year changes
  useEffect(() => {
    Promise.all([
      dataSource.fetchJamchartSongs(jamYear),
      dataSource.fetchJamchartPositions(jamYear),
    ]).then(([songs, positions]) => {
      setJamSongs(songs)
      setJamPositions(positions)
    }).catch(() => {})
  }, [jamYear])

  // Fetch comparison data when we have 2+ users (skip in public mode)
  useEffect(() => {
    if (isPublic) return
    if (users.length < 2) return

    const params = users.map(u => `user=${encodeURIComponent(u.username)}`).join('&')

    // Fetch compare songs + all shows + per-user stats in parallel
    Promise.all([
      fetch(`/api/compare-songs?${params}`).then(r => r.ok ? r.json() : null),
      fetch('/api/all-shows').then(r => r.ok ? r.json() : []),
      ...users.map(u =>
        fetch(`/api/stats?username=${encodeURIComponent(u.username)}`).then(r => r.ok ? r.json() : null)
      ),
    ]).then(([compare, shows, ...userStats]) => {
      setCompareData(compare)
      setAllShows(shows)
      setAllStats(userStats.filter(Boolean))
    }).catch(() => {})
  }, [users])

  if (!isPublic && error) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Phish Stats</h1>
        <p style={{ color: '#666' }}>{error}</p>
      </div>
    )
  }

  if (!isPublic && !stats) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Phish Stats</h1>
        <p>Loading...</p>
      </div>
    )
  }

  const hasCompareData = compareData && compareData.usernames.length >= 2

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1400px', margin: '0 auto' }}>
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        scrollToFirstStep
        callback={handleTourCallback}
        styles={{
          options: {
            primaryColor: '#ef4444',
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: 8,
          },
          buttonNext: {
            borderRadius: 6,
          },
          buttonBack: {
            color: '#666',
          },
        }}
        locale={{
          last: 'Let\'s go!',
          skip: 'Skip tour',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>
          {isPublic ? 'Phish 3.0 Jamchart Analysis' : 'Phish Stats'}
          {jamSongs.length > 0 && (
            <button
              onClick={() => { setRunTour(false); setTimeout(() => { setActiveJam('vehicles'); setRunTour(true) }, 100) }}
              style={{
                marginLeft: '1rem', padding: '0.3rem 0.8rem', fontSize: '0.75rem',
                background: 'none', border: '1px solid #ccc', borderRadius: '4px',
                color: '#888', cursor: 'pointer', verticalAlign: 'middle',
              }}
            >
              Take Tour
            </button>
          )}
        </h1>
        {!isPublic && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {users.length > 1 && (
              <select
                value={activeUser}
                onChange={e => setActiveUser(e.target.value)}
                style={{ padding: '0.4rem', fontSize: '0.9rem' }}
              >
                {users.map(u => (
                  <option key={u.username} value={u.username}>
                    {u.username} ({u.show_count} shows)
                  </option>
                ))}
              </select>
            )}
            <button onClick={fetchData} style={{ padding: '0.4rem 1rem', cursor: 'pointer' }}>Refresh</button>
          </div>
        )}
      </div>

      {!isPublic && stats && (
        <>
          <h2 style={{ color: '#444', marginTop: 0 }}>{stats.username}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Shows" value={stats.totalShows} />
            <StatCard label="Songs Heard" value={stats.totalPerformances} />
            <StatCard label="Unique Songs" value={stats.uniqueSongs} />
            <StatCard label="States" value={stats.statesVisited.length} />
            <StatCard label="Venues" value={stats.venuesVisited.length} />
            <StatCard label="First Show" value={stats.firstShow ?? '\u2014'} />
            <StatCard label="Last Show" value={stats.lastShow ?? '\u2014'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div>
              <h2>Top Songs</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Song</th>
                    <th style={thStyle}>Shows</th>
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
        </>
      )}

      {/* Jamchart Analysis Section */}
      {(jamSongs.length > 0 || jamYears.length > 0) && (
        <div data-tour="jamchart-section" style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Jamchart Analysis</h2>
            <label data-tour="year-picker" style={{ fontSize: '0.85rem', color: '#666' }}>
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
            {jamYear === 'all' ? 'All Phish 3.0 shows (2009\u2013present)' : `Shows from ${jamYear}`} \u2014 {jamSongs.length} songs in the database.
          </p>

          <div style={{
            display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem',
          }}>
            {JAM_TABS.map(tab => (
              <button
                key={tab.key}
                data-tour={`tab-${tab.key}`}
                onClick={() => setActiveJam(tab.key)}
                style={{
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  border: 'none',
                  borderBottom: activeJam === tab.key ? '3px solid #ef4444' : '3px solid transparent',
                  background: 'none',
                  color: activeJam === tab.key ? '#ef4444' : '#666',
                  fontWeight: activeJam === tab.key ? '600' : '400',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            {activeJam === 'vehicles' && (
              <JamVehicleScatter songs={jamSongs} />
            )}
            {activeJam === 'heat-calendar' && (
              <ShowHeatCalendar year={jamYear} />
            )}
            {activeJam === 'venue-rankings' && (
              <VenueRankings year={jamYear} />
            )}
            {activeJam === 'jam-evolution' && (
              <JamEvolution />
            )}
            {activeJam === 'song-pairings' && (
              <SongPairings year={jamYear} />
            )}
            {activeJam === 'positions' && (
              <JamchartPositionMap data={jamPositions} />
            )}
            {activeJam === 'rankings' && (
              <JamchartRankings songs={jamSongs} />
            )}
            {activeJam === 'deep-dive' && (
              <SongDeepDive year={jamYear} />
            )}
          </div>
        </div>
      )}

      {/* Visualization Section (hidden in public mode) */}
      {!isPublic && hasCompareData && (
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>User Comparisons</h2>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem',
          }}>
            {VIZ_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveViz(tab.key)}
                style={{
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  border: 'none',
                  borderBottom: activeViz === tab.key ? '3px solid #2563eb' : '3px solid transparent',
                  background: 'none',
                  color: activeViz === tab.key ? '#2563eb' : '#666',
                  fontWeight: activeViz === tab.key ? '600' : '400',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active visualization */}
          <div style={{ overflowX: 'auto' }}>
            {activeViz === 'heatmap' && (
              <SongHeatmap allUsernames={compareData!.usernames} matrix={compareData!.matrix} />
            )}
            {activeViz === 'scatter' && (
              <SongScatter allUsernames={compareData!.usernames} matrix={compareData!.matrix} />
            )}
            {activeViz === 'timeline' && allShows.length > 0 && (
              <ShowTimeline allShows={allShows} allUsernames={compareData!.usernames} />
            )}
            {activeViz === 'years' && allShows.length > 0 && (
              <YearCompare allShows={allShows} allUsernames={compareData!.usernames} />
            )}
            {activeViz === 'radar' && allStats.length > 0 && (
              <RadarChart userSummaries={allStats} />
            )}
            {activeViz === 'gaps' && (
              <SongGaps allUsernames={compareData!.usernames} matrix={compareData!.matrix} />
            )}
          </div>
        </div>
      )}
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
