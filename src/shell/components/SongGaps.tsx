import { useState } from 'react'

interface HeatmapRow {
  song: string
  [username: string]: string | number
}

interface Props {
  allUsernames: string[]
  matrix: HeatmapRow[]
}

const USER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c']

export default function SongGaps({ allUsernames, matrix }: Props) {
  const [targetUser, setTargetUser] = useState(allUsernames[0])

  // For each other user, find songs they've seen a lot that targetUser hasn't (or barely has)
  const recommendations: { fromUser: string; song: string; theirCount: number; yourCount: number }[] = []

  for (const otherUser of allUsernames) {
    if (otherUser === targetUser) continue

    for (const row of matrix) {
      const yourCount = row[targetUser] as number
      const theirCount = row[otherUser] as number

      // They've seen it 3+ times more than you, and you've seen it 2 or fewer times
      if (theirCount >= 3 && yourCount <= 2 && theirCount - yourCount >= 3) {
        recommendations.push({
          fromUser: otherUser,
          song: row.song as string,
          theirCount,
          yourCount,
        })
      }
    }
  }

  // Sort by biggest gap
  recommendations.sort((a, b) => (b.theirCount - b.yourCount) - (a.theirCount - a.yourCount))

  // Unique songs you've never seen
  const neverSeen = matrix.filter(row => {
    const yourCount = row[targetUser] as number
    const othersTotal = allUsernames
      .filter(u => u !== targetUser)
      .reduce((sum, u) => sum + (row[u] as number), 0)
    return yourCount === 0 && othersTotal > 0
  }).sort((a, b) => {
    const totalA = allUsernames.filter(u => u !== targetUser).reduce((s, u) => s + (a[u] as number), 0)
    const totalB = allUsernames.filter(u => u !== targetUser).reduce((s, u) => s + (b[u] as number), 0)
    return totalB - totalA
  })

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.9rem' }}>
          Show recommendations for:
          <select
            value={targetUser}
            onChange={e => setTargetUser(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.3rem' }}
          >
            {allUsernames.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Songs you've never seen */}
        <div>
          <h3 style={{ color: '#444', marginTop: 0 }}>
            Songs You've Never Seen ({neverSeen.length})
          </h3>
          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Songs your friends have seen that you haven't caught yet.
          </p>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Song</th>
                  {allUsernames.filter(u => u !== targetUser).map((u, i) => (
                    <th key={u} style={{ ...thStyle, color: USER_COLORS[allUsernames.indexOf(u) % USER_COLORS.length] }}>
                      {u}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {neverSeen.slice(0, 50).map((row, idx) => (
                  <tr key={row.song as string} style={{ background: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: '500' }}>{row.song}</td>
                    {allUsernames.filter(u => u !== targetUser).map(u => (
                      <td key={u} style={tdStyle}>{row[u]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Songs others have seen way more */}
        <div>
          <h3 style={{ color: '#444', marginTop: 0 }}>
            Songs to Catch More ({recommendations.length})
          </h3>
          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Songs your friends have seen way more than you.
          </p>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Song</th>
                  <th style={thStyle}>Friend</th>
                  <th style={thStyle}>Theirs</th>
                  <th style={thStyle}>Yours</th>
                  <th style={thStyle}>Gap</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.slice(0, 50).map((rec, idx) => {
                  const friendColor = USER_COLORS[allUsernames.indexOf(rec.fromUser) % USER_COLORS.length]
                  return (
                    <tr key={`${rec.song}-${rec.fromUser}`} style={{ background: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: '500' }}>{rec.song}</td>
                      <td style={{ ...tdStyle, color: friendColor }}>{rec.fromUser}</td>
                      <td style={tdStyle}>{rec.theirCount}</td>
                      <td style={tdStyle}>{rec.yourCount}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold', color: '#dc2626' }}>+{rec.theirCount - rec.yourCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderBottom: '2px solid #ddd',
  textAlign: 'center',
  fontSize: '0.8rem',
  color: '#666',
  position: 'sticky',
  top: 0,
  background: 'white',
}

const tdStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem',
  borderBottom: '1px solid #eee',
  textAlign: 'center',
  fontSize: '0.85rem',
}
