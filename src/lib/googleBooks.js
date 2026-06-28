const BASE = 'https://www.googleapis.com/books/v1'
const KEY = import.meta.env.VITE_GOOGLE_BOOKS_KEY || ''

// Strip the imgtk signed token (zoom-specific, expires) and normalize to https.
// Fall back to a direct content URL constructed from the volume ID.
function cleanImg(url, id) {
  if (url) return url.replace('http:', 'https:').replace(/&imgtk=[^&]+/, '')
  return `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1`
}

function params(obj) {
  const p = new URLSearchParams(obj)
  if (KEY) p.set('key', KEY)
  return p.toString()
}

export function normalizeVolume(v) {
  const info = v.volumeInfo || {}
  return {
    id: v.id,
    title: info.title || 'Unknown Title',
    authors: info.authors || [],
    description: info.description || '',
    cover: cleanImg(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail, v.id),
    coverLarge: cleanImg(info.imageLinks?.large || info.imageLinks?.medium, v.id),
    publishedDate: info.publishedDate || '',
    publisher: info.publisher || '',
    pageCount: info.pageCount || null,
    categories: info.categories || [],
    averageRating: info.averageRating || null,
    ratingsCount: info.ratingsCount || 0,
    isbn: info.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier || null,
    language: info.language || 'en',
    previewLink: info.previewLink || null,
  }
}

export async function searchBooks(query, { startIndex = 0, maxResults = 20, orderBy, filter } = {}) {
  const p = { q: query, startIndex, maxResults, printType: 'books' }
  if (orderBy) p.orderBy = orderBy
  if (filter) p.filter = filter
  const url = `${BASE}/volumes?${params(p)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Google Books search failed')
  const data = await res.json()
  return {
    total: data.totalItems || 0,
    books: (data.items || []).map(normalizeVolume),
  }
}

export async function getVolume(id) {
  const url = `${BASE}/volumes/${id}?${params({})}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Book not found')
  const data = await res.json()
  return normalizeVolume(data)
}

export async function getRelatedBooks(book) {
  const author = book.authors?.[0]
  const category = book.categories?.[0]
  const queries = []
  if (author) queries.push(searchBooks(`inauthor:"${author}"`, { maxResults: 6 }))
  if (category) queries.push(searchBooks(`subject:"${category}"`, { maxResults: 6 }))
  const results = await Promise.allSettled(queries)
  const books = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.books)
    .filter(b => b.id !== book.id)
  // deduplicate
  const seen = new Set()
  return books.filter(b => seen.has(b.id) ? false : seen.add(b.id))
}
