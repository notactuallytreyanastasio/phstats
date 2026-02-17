/**
 * Bookmark persistence pipeline:
 * 1. localStorage for instant UX
 * 2. GitHub Contents API to append to data/bookmarks.json
 * 3. Commit triggers deploy workflow → bookmarks baked into static build
 * 4. On load, merge localStorage + static build bookmarks
 */

const LS_KEY = 'phstats-bookmarks'
const REPO_OWNER = 'notactuallytreyanastasio'
const REPO_NAME = 'phstats'
const BOOKMARKS_PATH = 'data/bookmarks.json'

export interface Bookmark {
  song: string
  date: string
  jamUrl: string
  venue: string
  duration_ms: number
  isJamchart: boolean
  jamNotes: string
  addedAt: number
}

// --- localStorage layer (instant) ---

function readLocal(): Bookmark[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLocal(bookmarks: Bookmark[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(bookmarks))
}

// --- Static build layer (load from deployed bookmarks.json) ---

let staticBookmarks: Bookmark[] | null = null

async function loadStaticBookmarks(): Promise<Bookmark[]> {
  if (staticBookmarks !== null) return staticBookmarks
  try {
    const base = import.meta.env.BASE_URL || '/'
    const r = await fetch(`${base}data/bookmarks.json`)
    if (!r.ok) { staticBookmarks = []; return [] }
    const data = await r.json()
    staticBookmarks = Array.isArray(data) ? data : []
    return staticBookmarks
  } catch {
    staticBookmarks = []
    return []
  }
}

// --- Merged view (static + local, deduplicated) ---

function dedup(bookmarks: Bookmark[]): Bookmark[] {
  const seen = new Set<string>()
  return bookmarks.filter(b => {
    const key = `${b.song}|${b.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const [staticBm, localBm] = await Promise.all([
    loadStaticBookmarks(),
    Promise.resolve(readLocal()),
  ])
  // Local bookmarks take priority (newer), then static
  return dedup([...localBm, ...staticBm])
}

export function getBookmarksSync(): Bookmark[] {
  // Synchronous version using only localStorage (for initial render)
  return readLocal()
}

export function isBookmarked(song: string, date: string): boolean {
  return readLocal().some(b => b.song === song && b.date === date)
}

// --- Add bookmark: localStorage + GitHub API ---

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  // 1. Save to localStorage immediately
  const local = readLocal()
  if (local.some(b => b.song === bookmark.song && b.date === bookmark.date)) return
  local.unshift(bookmark)
  writeLocal(local)

  // 2. Fire GitHub API to persist (fire-and-forget, don't block UI)
  persistToGitHub(bookmark).catch(err => {
    console.warn('GitHub bookmark sync failed:', err)
  })
}

export function removeBookmark(song: string, date: string): void {
  const local = readLocal().filter(b => !(b.song === song && b.date === date))
  writeLocal(local)
  // Note: removal from GitHub would require reading + rewriting the file.
  // For now, removals are local-only. The build file is append-only.
}

// --- GitHub Contents API layer ---

async function persistToGitHub(bookmark: Bookmark): Promise<void> {
  const token = import.meta.env.VITE_GH_BOOKMARK_TOKEN
  if (!token) {
    console.info('No VITE_GH_BOOKMARK_TOKEN set, bookmark saved locally only')
    return
  }

  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${BOOKMARKS_PATH}`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }

  // Get current file content + SHA
  let existingBookmarks: Bookmark[] = []
  let sha: string | undefined

  try {
    const getRes = await fetch(apiBase, { headers })
    if (getRes.ok) {
      const fileData = await getRes.json()
      sha = fileData.sha
      const decoded = atob(fileData.content.replace(/\n/g, ''))
      existingBookmarks = JSON.parse(decoded)
    }
  } catch {
    // File doesn't exist yet or parse error — will create
  }

  // Check for duplicate
  if (existingBookmarks.some(b => b.song === bookmark.song && b.date === bookmark.date)) {
    return // Already in the repo
  }

  // Append new bookmark
  existingBookmarks.push(bookmark)
  const newContent = btoa(JSON.stringify(existingBookmarks, null, 2))

  const body: Record<string, unknown> = {
    message: `bookmark: ${bookmark.song} (${bookmark.date})`,
    content: newContent,
    branch: 'main',
  }
  if (sha) body.sha = sha

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new Error(`GitHub API error ${putRes.status}: ${err}`)
  }
}
