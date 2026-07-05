import { getShelves, addToShelf } from './shelves'
import { setBookRating } from './ratings'
import { searchBooks, normalizeVolume } from './googleBooks'

const SHELF_TO_GOODREADS = {
  'read': 'read',
  'currently-reading': 'currently-reading',
  'want-to-read': 'to-read',
}
const GOODREADS_TO_SHELF = {
  'read': 'read',
  'currently-reading': 'currently-reading',
  'to-read': 'want-to-read',
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportCSV() {
  const shelves = await getShelves()
  const rows = []

  for (const [shelf, books] of Object.entries(shelves)) {
    for (const book of books) {
      rows.push({
        Title: book.title || '',
        Author: book.authors?.[0] || '',
        ISBN13: book.isbn || '',
        Shelf: SHELF_TO_GOODREADS[shelf] || shelf,
        'Date Added': book.addedAt ? new Date(book.addedAt).toISOString().slice(0, 10) : '',
        Pages: book.pageCount || '',
        'Year Published': book.publishedDate?.slice(0, 4) || '',
        Publisher: book.publisher || '',
        'Avg Rating': book.averageRating || '',
        'Google Books ID': book.id || '',
      })
    }
  }

  if (!rows.length) return false

  const headers = Object.keys(rows[0])
  const escape = v => `"${String(v).replace(/"/g, '""')}"`
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `readgoods-library-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  return true
}

// ── Import parsing ────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Parse a single CSV line respecting quoted fields
  function parseLine(line) {
    const fields = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        fields.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur)
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim()]))
  }).filter(row => Object.values(row).some(Boolean))
}

// Detect which column maps to which field (handles Goodreads + our own export)
function detectColumns(headers) {
  const h = headers.map(x => x.toLowerCase())
  const find = (...keys) => headers[h.findIndex(x => keys.some(k => x.includes(k)))] || null
  return {
    title: find('title'),
    author: find('author'),
    isbn: find('isbn13', 'isbn'),
    shelf: find('exclusive shelf', 'shelf', 'bookshelves'),
    rating: find('my rating', 'rating'),
    googleId: find('google books id'),
  }
}

export function parseImportFile(text) {
  const rows = parseCSV(text)
  if (!rows.length) return []
  const cols = detectColumns(Object.keys(rows[0]))

  return rows.map(row => ({
    title: cols.title ? row[cols.title] : '',
    author: cols.author ? row[cols.author] : '',
    isbn: cols.isbn ? row[cols.isbn]?.replace(/[^0-9X]/gi, '') : '',
    shelf: cols.shelf ? (GOODREADS_TO_SHELF[row[cols.shelf]] || 'want-to-read') : 'want-to-read',
    rating: cols.rating ? parseInt(row[cols.rating], 10) || null : null,
    googleId: cols.googleId ? row[cols.googleId] : '',
  })).filter(r => r.title)
}

// ── Import execution ──────────────────────────────────────────────────────────

async function lookupBook(row) {
  // Try ISBN first (most accurate)
  if (row.isbn) {
    try {
      const res = await searchBooks(`isbn:${row.isbn}`, { maxResults: 1 })
      if (res.books[0]) return res.books[0]
    } catch {}
  }
  // Fall back to title + author
  try {
    const q = row.author
      ? `intitle:"${row.title}" inauthor:"${row.author}"`
      : `intitle:"${row.title}"`
    const res = await searchBooks(q, { maxResults: 1 })
    if (res.books[0]) return res.books[0]
  } catch {}
  return null
}

// onProgress(current, total, status) — called as each book is processed
export async function importBooks(rows, onProgress) {
  const results = { imported: 0, skipped: 0, failed: 0 }
  const delay = ms => new Promise(r => setTimeout(r, ms))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress(i + 1, rows.length, `Looking up "${row.title}"…`)
    try {
      const book = await lookupBook(row)
      if (book) {
        await addToShelf(row.shelf, book)
        if (row.rating) await setBookRating(book.id, row.rating)
        results.imported++
      } else {
        results.failed++
      }
    } catch {
      results.failed++
    }
    // Respect Google Books rate limit (~1 req/sec)
    if (i < rows.length - 1) await delay(300)
  }

  return results
}
