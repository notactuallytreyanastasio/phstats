/**
 * Utility for reading/writing URL search params without page reloads.
 * Uses standard query string (window.location.search).
 * Enables shareable links for any view state.
 */

export function getParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key)
}

export function setParams(updates: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const qs = params.toString()
  const url = window.location.pathname + (qs ? `?${qs}` : '')
  window.history.replaceState(null, '', url)
}
