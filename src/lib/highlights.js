const KEY = 'readgoods_highlights'

export function getHighlights() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function getBookHighlights(bookId) {
  return getHighlights()[bookId] || []
}

export function addHighlight(bookId, text, page) {
  const all = getHighlights()
  if (!all[bookId]) all[bookId] = []
  all[bookId].unshift({ id: Date.now(), text: text.trim(), page: page || null, addedAt: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(all))
  return all[bookId]
}

export function removeHighlight(bookId, id) {
  const all = getHighlights()
  if (!all[bookId]) return
  all[bookId] = all[bookId].filter(h => h.id !== id)
  if (!all[bookId].length) delete all[bookId]
  localStorage.setItem(KEY, JSON.stringify(all))
}

// Returns a random highlight from any book, paired with its bookId
export function getRandomHighlight() {
  const all = getHighlights()
  const entries = Object.entries(all).flatMap(([bookId, hs]) => hs.map(h => ({ ...h, bookId })))
  if (!entries.length) return null
  return entries[Math.floor(Math.random() * entries.length)]
}
