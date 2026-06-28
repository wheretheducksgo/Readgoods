const KEY = 'readgoods_shelves'

const defaults = {
  'want-to-read': [],
  'currently-reading': [],
  'read': [],
}

export function getShelves() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { ...defaults }
  } catch {
    return { ...defaults }
  }
}

export function saveShelves(shelves) {
  localStorage.setItem(KEY, JSON.stringify(shelves))
}

export function getBookShelf(bookId) {
  const shelves = getShelves()
  for (const [shelf, books] of Object.entries(shelves)) {
    if (books.some(b => b.id === bookId)) return shelf
  }
  return null
}

export function addToShelf(shelf, book) {
  const shelves = getShelves()
  // remove from any existing shelf first
  for (const key of Object.keys(shelves)) {
    shelves[key] = shelves[key].filter(b => b.id !== book.id)
  }
  shelves[shelf] = [{ ...book, addedAt: Date.now() }, ...shelves[shelf]]
  saveShelves(shelves)
  return shelves
}

export function removeFromShelves(bookId) {
  const shelves = getShelves()
  for (const key of Object.keys(shelves)) {
    shelves[key] = shelves[key].filter(b => b.id !== bookId)
  }
  saveShelves(shelves)
  return shelves
}

export function getRecentBooks(limit = 10) {
  const shelves = getShelves()
  const all = Object.entries(shelves).flatMap(([shelf, books]) =>
    books.map(b => ({ ...b, shelf }))
  )
  return all.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, limit)
}
