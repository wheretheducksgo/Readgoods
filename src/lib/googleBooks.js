const BASE = 'https://www.googleapis.com/books/v1'
const KEY = import.meta.env.VITE_GOOGLE_BOOKS_KEY || ''

// Normalize to https and strip the expiring imgtk token.
function cleanImg(url) {
  if (!url) return null
  return url.replace('http:', 'https:').replace(/&imgtk=[^&]+/, '')
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
    cover: cleanImg(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail),
    coverLarge: cleanImg(info.imageLinks?.large || info.imageLinks?.medium),
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
