/**
 * Utility for reading/writing URL search params without page reloads.
 * Works with HashRouter: params live inside the hash (e.g., #/phangraphs?ys=2020).
 * Enables shareable links for any view state.
 */

function getHashSearch(): string {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  return qIndex >= 0 ? hash.substring(qIndex) : ''
}

function getHashPath(): string {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  return qIndex >= 0 ? hash.substring(0, qIndex) : hash
}

export function getParam(key: string): string | null {
  return new URLSearchParams(getHashSearch()).get(key)
}

export function setParams(updates: Record<string, string | null>) {
  const params = new URLSearchParams(getHashSearch())
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const qs = params.toString()
  const newHash = getHashPath() + (qs ? `?${qs}` : '')
  const url = window.location.pathname + window.location.search + newHash
  window.history.replaceState(null, '', url)
}
