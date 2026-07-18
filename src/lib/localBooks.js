import { BOOKS, BOOK_BY_ID, BOOKS_BY_GENRE, GENRES, GENRE_HUES } from '../data/books'

// Re-export for consumers who only import from here
export { BOOKS, GENRES, GENRE_HUES }

export function getVolume(id) {
  const book = BOOK_BY_ID[id]
  if (!book) throw new Error('Book not found')
  return book
}

export function searchBooks(query, { startIndex = 0, maxResults = 20 } = {}) {
  if (!query) return { total: 0, books: [] }
  const q = query.toLowerCase()
  const results = BOOKS.filter(b =>
    b.title.toLowerCase().includes(q) ||
    b.authors.some(a => a.toLowerCase().includes(q)) ||
    b.categories.some(c => c.toLowerCase().includes(q)) ||
    b.description.toLowerCase().includes(q) ||
    (b.isbn && b.isbn.replace(/-/g, '').includes(q.replace(/-/g, '')))
  )
  return {
    total: results.length,
    books: results.slice(startIndex, startIndex + maxResults),
  }
}

export function getBooksByGenre(genre, { maxResults = 20 } = {}) {
  const books = BOOKS_BY_GENRE[genre] || []
  return books.slice(0, maxResults)
}

export function getNewBooks({ maxResults = 20, minYear = 2022 } = {}) {
  return BOOKS
    .filter(b => parseInt(b.publishedDate) >= minYear)
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .slice(0, maxResults)
}

export function getPopularBooks({ maxResults = 20 } = {}) {
  return [...BOOKS]
    .sort((a, b) => b.ratingsCount - a.ratingsCount)
    .slice(0, maxResults)
}

export function getRelatedBooks(book) {
  const genre = book.categories?.[0]
  const author = book.authors?.[0]
  const cited = (book.citations || []).map(id => BOOK_BY_ID[id]).filter(Boolean)

  const byAuthor = BOOKS.filter(b => b.id !== book.id && b.authors.includes(author))
  const byGenre = (BOOKS_BY_GENRE[genre] || []).filter(b => b.id !== book.id && !b.authors.includes(author))

  const seen = new Set()
  const results = []
  for (const b of [...cited, ...byAuthor, ...byGenre]) {
    if (!seen.has(b.id)) { seen.add(b.id); results.push(b) }
    if (results.length >= 8) break
  }
  return results
}

export function getSeriesBooks(seriesName) {
  if (!seriesName) return []
  return BOOKS
    .filter(b => b.seriesName === seriesName)
    .sort((a, b) => (a.seriesPosition || 0) - (b.seriesPosition || 0))
}

export function getCitations(book) {
  return (book.citations || []).map(id => BOOK_BY_ID[id]).filter(Boolean)
}

export function getCitedBy(book) {
  return BOOKS.filter(b => (b.citations || []).includes(book.id))
}

// For Home page genre browsing — returns { label, books }[]
export function getGenreSections({ genreCount = 4, booksPerGenre = 8 } = {}) {
  return GENRES.slice(0, genreCount).map(genre => ({
    label: genre,
    books: (BOOKS_BY_GENRE[genre] || []).slice(0, booksPerGenre),
  }))
}

// Shuffle helper for variety on home page
export function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
