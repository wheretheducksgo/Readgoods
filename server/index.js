import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const app = express()
const PORT = process.env.PORT || 3001

app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  const allowed = origin === 'http://localhost:5173' || origin === 'https://readgoods.vercel.app' || /^https:\/\/readgoods-[a-z0-9]+-wheretheducksgo\.vercel\.app$/.test(origin)
  if (allowed) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

const ol = axios.create({
  baseURL: 'https://openlibrary.org',
  timeout: 30000,
  headers: { 'User-Agent': 'Readgoods/1.0 (personal book tracker)' },
})

// Simple in-memory cache: key → { data, expiresAt }
const cache = new Map()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data
}
const MAX_CACHE_SIZE = 500
function cacheSet(key, data) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Evict the oldest entry (first inserted)
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL })
}

app.get('/api/health', (_, res) => res.json({ ok: true }))

// GET /api/reviews?title=...&author=...
app.get('/api/reviews', async (req, res) => {
  const { title, author } = req.query
  if (!title) return res.status(400).json({ error: 'Provide a title' })

  const cacheKey = `${title}||${author || ''}`
  const cached = cacheGet(cacheKey)
  if (cached) return res.json(cached)

  // Strip series prefixes like "Percy Jackson and the Lightning Thief" → "Lightning Thief"
  // so OL matches the standalone book rather than box sets.
  function shortenTitle(t) {
    const m = t.match(/\band\s+the\s+(.+)$/i) || t.match(/\band\s+(.+)$/i)
    return m ? m[1] : t
  }

  async function searchOL(titleQuery) {
    const res = await ol.get('/search.json', {
      params: {
        title: titleQuery, author: author || '',
        fields: 'key,title,ratings_average,ratings_count,want_to_read_count,currently_reading_count,already_read_count',
        limit: 5,
      },
    })
    const docs = res.data.docs || []
    return docs.find(d => (d.ratings_count ?? 0) > 0) || docs[0] || null
  }

  try {
    // Step 1: find the best matching work. Try full title first, then shortened.
    let work = await searchOL(title)
    if (!work?.ratings_count && shortenTitle(title) !== title) {
      work = await searchOL(shortenTitle(title)) || work
    }

    if (!work?.key) {
      const result = { found: false, warning: 'Book not found on Open Library.' }
      cacheSet(cacheKey, result)
      return res.json(result)
    }

    // Step 2: fetch ratings breakdown (for the bar chart) — single call, runs after step 1
    const workKey = work.key
    let ratingBreakdown = null
    try {
      const ratingsRes = await ol.get(`${workKey}/ratings.json`)
      ratingBreakdown = ratingsRes.data?.counts ?? null
    } catch {
      // breakdown optional — aggregate from step 1 is enough
    }

    const result = {
      found: true,
      title: work.title,
      workKey,
      avgRating: work.ratings_average ?? null,
      ratingCount: work.ratings_count ?? 0,
      ratingBreakdown,
      wantToRead: work.want_to_read_count ?? 0,
      currentlyReading: work.currently_reading_count ?? 0,
      alreadyRead: work.already_read_count ?? 0,
      source: 'Open Library',
    }
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error(err.message)
    res.status(500).json({ found: false, warning: 'Could not reach Open Library.' })
  }
})

// GET /api/series?title=&author=
// Returns the series name + this book's position using Open Library work metadata.
app.get('/api/series', async (req, res) => {
  const { title, author } = req.query
  if (!title) return res.status(400).json({ error: 'Provide a title' })

  const cacheKey = `series:${title}||${author || ''}`
  const cached = cacheGet(cacheKey)
  if (cached) return res.json(cached)

  function stripPrefix(t) {
    const m = t.match(/\band\s+the\s+(.+)$/i) || t.match(/\band\s+(.+)$/i)
    return m ? m[1] : t
  }

  // Try to find an OL work that has series data (via series field or Serie: subject).
  // Returns { workKey, seriesEntries, workData, subjectSlug } or null.
  async function findWorkWithSeries(titleQuery) {
    const r = await ol.get('/search.json', {
      params: { title: titleQuery, author: author || '', fields: 'key,title', limit: 8 },
    })
    let fallbackSubject = null
    for (const doc of (r.data.docs || [])) {
      if (!doc.key) continue
      try {
        const wr = await ol.get(`${doc.key}.json`)
        const entries = wr.data?.series || []
        if (entries.length) return { workKey: doc.key, seriesEntries: entries, workData: wr.data }
        // No series entries — check subjects for Serie:/Series: tag as fallback
        if (!fallbackSubject) {
          const subjects = wr.data?.subjects || []
          const tag = subjects.find(s => s.startsWith('Series:') || s.startsWith('Serie:'))
          if (tag) {
            const slug = tag.startsWith('Series:') ? tag.slice(7) : tag.slice(6)
            fallbackSubject = { workKey: doc.key, workData: wr.data, slug }
          }
        }
      } catch {}
    }
    // Return subject-based fallback if found (book is in a series via subject tag)
    if (fallbackSubject) return { workKey: fallbackSubject.workKey, seriesEntries: [], workData: fallbackSubject.workData, subjectSlug: fallbackSubject.slug }
    return null
  }

  try {
    // Step 1: search with full title, then shortened form if needed
    let found = await findWorkWithSeries(title)
    const short = stripPrefix(title)
    if (!found && short !== title) found = await findWorkWithSeries(short)
    if (!found) {
      const r = { found: false }; cacheSet(cacheKey, r); return res.json(r)
    }
    const { seriesEntries, workData, subjectSlug } = found

    let seriesKey = seriesEntries[0]?.series?.key || null
    let position = seriesEntries[0]?.position ? parseFloat(seriesEntries[0].position) : null

    // Get series name from the series record
    let seriesName = null
    if (seriesKey) {
      try {
        const snRes = await ol.get(`${seriesKey}.json`)
        seriesName = snRes.data?.name || null
      } catch {}
    }

    // Fallback: extract from work subjects (Serie:/Series: slug format) or subjectSlug from search fallback
    if (!seriesName) {
      const subjects = workData?.subjects || []
      const tag = subjects.find(s => s.startsWith('Series:') || s.startsWith('Serie:'))
      const slug = subjectSlug || (tag ? (tag.startsWith('Series:') ? tag.slice(7) : tag.slice(6)) : null)
      if (slug) seriesName = slug.replace(/_/g, ' ')
    }

    if (!seriesName) {
      const r = { found: false }; cacheSet(cacheKey, r); return res.json(r)
    }

    // If position is still unknown (subject-based detection), find it from the cached series books list
    if (position === null) {
      try {
        // Check all series-books cache entries for a title match
        const normTitle = title.toLowerCase().trim()
        for (const [key, entry] of cache.entries()) {
          if (!key.startsWith('series-books4:')) continue
          const books = entry.data
          if (!Array.isArray(books)) continue
          const match = books.find(b => b.title?.toLowerCase().trim() === normTitle)
          if (match) { position = match.position; break }
        }
      } catch {}
    }

    const result = { found: true, seriesName, position, seriesKey: seriesKey || null }
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Series lookup error:', err.message)
    res.status(500).json({ found: false })
  }
})

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_KEY })
const summaryCache = new Map()

// GET /api/ai-summary?title=&author=&avgRating=&ratingCount=&breakdown=
app.get('/api/ai-summary', async (req, res) => {
  const { title, author, avgRating, ratingCount, breakdown } = req.query
  if (!title) return res.status(400).json({ error: 'Provide a title' })

  const cacheKey = `summary:${title}||${author || ''}`
  const cached = cacheGet(cacheKey)
  if (cached) return res.json(cached)

  try {
    let breakdownText = ''
    if (breakdown) {
      try {
        const b = JSON.parse(breakdown)
        breakdownText = `Rating breakdown — 5★: ${b['5'] || 0}, 4★: ${b['4'] || 0}, 3★: ${b['3'] || 0}, 2★: ${b['2'] || 0}, 1★: ${b['1'] || 0}.`
      } catch {}
    }

    const prompt = `You are summarizing community reception for a book app. Based only on the rating data below, write 2-3 sentences describing what readers think of "${title}"${author ? ` by ${author}` : ''}. Focus on the overall sentiment and what the distribution suggests about reader experience. Do not invent specific opinions or quotes — base it purely on the numbers.

Average rating: ${avgRating ? Number(avgRating).toFixed(1) : 'unknown'}/5
Total ratings: ${ratingCount ? Number(ratingCount).toLocaleString() : 'unknown'}
${breakdownText}

Write in a warm, concise tone. No bullet points.`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 180,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = message.content[0]?.text?.trim() || null
    const result = { summary }
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('AI summary error:', err.message)
    res.status(500).json({ summary: null })
  }
})

// Parse a book number from a title string (e.g. "Book 3", "#4", "Volume 2")
function parseBookNumber(title = '') {
  const WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 }
  const m =
    title.match(/book\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)/i) ||
    title.match(/#\s*(\d+)/i) ||
    title.match(/vol(?:ume)?\s*\.?\s*(\d+)/i) ||
    title.match(/part\s+(\d+)/i)
  if (!m) return null
  const v = m[1].toLowerCase()
  return WORDS[v] ?? parseInt(v)
}

const GB_KEY = process.env.VITE_GOOGLE_BOOKS_KEY

// GET /api/series/books?seriesName=&seriesKey=&author=
// Returns all books in a series with their positions.
// Primary: OL series_key search (exact). Fallback: OL subject slug search.
app.get('/api/series/books', async (req, res) => {
  const { seriesName, seriesKey } = req.query
  if (!seriesName && !seriesKey) return res.status(400).json({ error: 'Provide seriesName or seriesKey' })

  const cacheKey = `series-books4:${seriesKey || seriesName}`
  const cached = cacheGet(cacheKey)
  if (cached) return res.json(cached)

  try {
    let olDocs = []

    // 1a. If we have the OL series key (e.g. /series/12345), search directly — most accurate
    if (seriesKey) {
      try {
        const r = await ol.get('/search.json', {
          params: { q: `series_key:${seriesKey}`, fields: 'key,title,first_publish_year,cover_i', limit: 50 },
        })
        olDocs = r.data.docs || []
      } catch {}
    }

    // 1b. Fall back to subject slug search if direct key search returned nothing
    if (olDocs.length === 0 && seriesName) {
      try {
        const slug = seriesName.replace(/\s*&\s*/g, '_and_').replace(/\s+/g, '_')
        const r = await ol.get('/search.json', {
          params: { q: `subject:"Serie:${slug}"`, fields: 'key,title,first_publish_year,cover_i', limit: 50 },
        })
        olDocs = r.data.docs || []
      } catch {}
    }

    // Deduplicate OL docs by normalized title, keep earliest year
    const byTitle = new Map()
    for (const d of olDocs) {
      const key = d.title?.toLowerCase().trim()
      if (!key) continue
      const ex = byTitle.get(key)
      if (!ex || (d.first_publish_year && (!ex.first_publish_year || d.first_publish_year < ex.first_publish_year))) {
        byTitle.set(key, d)
      }
    }

    // Fetch OL work records in parallel to get series positions
    const withPositions = await Promise.allSettled(
      [...byTitle.values()].map(async d => {
        let position = null
        try {
          const wr = await ol.get(`${d.key}.json`, { timeout: 6000 })
          const entry = wr.data?.series?.[0]
          position = entry?.position ? parseFloat(entry.position) : null
        } catch {}
        if (position === null) position = parseBookNumber(d.title)
        return {
          title: d.title,
          year: d.first_publish_year || null,
          position,
          cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
          olKey: d.key,
        }
      })
    )

    const resolved = withPositions.filter(r => r.status === 'fulfilled').map(r => r.value)

    // Deduplicate positioned books by position, keeping the entry with a cover
    const byPos = new Map()
    const noPosition = []
    for (const b of resolved) {
      if (b.position === null) { noPosition.push(b); continue }
      const ex = byPos.get(b.position)
      if (!ex || (!ex.cover && b.cover)) byPos.set(b.position, b)
    }

    let books
    if (byPos.size > 0) {
      // Append positionless books after the positioned ones, sorted by year
      const positionless = noPosition
        .sort((a, b) => (a.year || 9999) - (b.year || 9999))
        .map((b, i) => ({ ...b, position: byPos.size + i + 1 }))
      books = [...byPos.values()].sort((a, b) => a.position - b.position).concat(positionless)
    } else {
      // No positions found — sort by year and assign sequential positions
      books = resolved.sort((a, b) => (a.year || 9999) - (b.year || 9999)).map((b, i) => ({ ...b, position: i + 1 }))
    }

    if (books.length) cacheSet(cacheKey, books)
    res.json(books)
  } catch (err) {
    console.error('Series books error:', err.message)
    res.status(500).json([])
  }
})

// POST /api/ai-recommend
// Body: { library: [{title, authors, categories}], notes: [{title, note}] }
app.post('/api/ai-recommend', async (req, res) => {
  const { library = [], notes = [] } = req.body
  if (!library.length) return res.json({ recommendation: null })

  const cacheKey = `ai-rec:${library.map(b => b.title).sort().join('|')}`
  const cached = cacheGet(cacheKey)
  if (cached) return res.json(cached)

  try {
    const libraryList = library.slice(0, 30).map(b =>
      `- "${b.title}" by ${b.authors?.[0] || 'Unknown'}${b.categories?.length ? ` [${b.categories[0]}]` : ''}`
    ).join('\n')

    const notesList = notes.slice(0, 5).map(n =>
      `"${n.title}": ${n.note.slice(0, 200)}`
    ).join('\n')

    const prompt = `You are a thoughtful book recommender with deep knowledge of literature.

A reader's library contains these books:
${libraryList}

${notesList ? `Their notes on some books:\n${notesList}\n` : ''}
Based on their reading taste, recommend ONE book they haven't read yet. Pick something that genuinely fits their pattern — not just a bestseller.

Respond in this exact JSON format:
{
  "title": "Book Title",
  "author": "Author Name",
  "reason": "2-3 sentence explanation of why this fits their taste specifically, referencing books they've read."
}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0]?.text?.trim() || ''
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}')
    const result = { recommendation: json.title ? json : null }
    if (result.recommendation) cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('AI recommend error:', err.message)
    res.json({ recommendation: null })
  }
})

// ── Book Club ─────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Per-club mutex to serialize concurrent member updates and prevent TOCTOU data loss
const clubLocks = new Map()
async function withClubLock(clubId, fn) {
  const pending = clubLocks.get(clubId) || Promise.resolve()
  let release
  const next = new Promise(r => { release = r })
  clubLocks.set(clubId, next)
  await pending
  try { return await fn() } finally {
    release()
    if (clubLocks.get(clubId) === next) clubLocks.delete(clubId)
  }
}

// POST /api/club — create a new club
app.post('/api/club', async (req, res) => {
  const { bookId, bookTitle, bookCover, creatorName } = req.body
  if (!bookId || !bookTitle || !creatorName) return res.status(400).json({ error: 'Missing fields' })
  if (String(bookTitle).length > 500 || String(creatorName).length > 200) return res.status(400).json({ error: 'Field too long' })
  if (bookCover) {
    try {
      const u = new URL(bookCover)
      if (u.protocol !== 'https:') return res.status(400).json({ error: 'bookCover must be an https:// URL' })
    } catch { return res.status(400).json({ error: 'bookCover is not a valid URL' }) }
  }
  const id = makeId()
  const { error } = await sb.from('book_clubs').insert({
    id,
    book_id: bookId,
    book_title: bookTitle,
    book_cover: bookCover || null,
    members: [{ name: creatorName, progress: '', note: '', updatedAt: Date.now() }],
  })
  if (error) { console.error(error); return res.status(500).json({ error: 'DB error' }) }
  res.json({ clubId: id })
})

// GET /api/club/:id — fetch club data
app.get('/api/club/:id', async (req, res) => {
  const { data, error } = await sb
    .from('book_clubs')
    .select('*')
    .eq('id', req.params.id.toUpperCase())
    .maybeSingle()
  if (error || !data) return res.status(404).json({ error: 'Club not found' })
  res.json({
    id: data.id,
    bookId: data.book_id,
    bookTitle: data.book_title,
    bookCover: data.book_cover,
    createdAt: new Date(data.created_at).getTime(),
    members: data.members || [],
  })
})

// POST /api/club/:id/update — upsert a member's progress/note
app.post('/api/club/:id/update', async (req, res) => {
  const clubId = req.params.id.toUpperCase()
  const { name, progress, note } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  if (typeof name === 'string' && name.length > 200) return res.status(400).json({ error: 'Name too long' })
  if (progress && typeof progress === 'string' && progress.length > 200) return res.status(400).json({ error: 'Progress too long' })
  if (note && typeof note === 'string' && note.length > 5000) return res.status(400).json({ error: 'Note too long' })

  let upErr
  try {
    await withClubLock(clubId, async () => {
      const { data: club, error } = await sb.from('book_clubs').select('members').eq('id', clubId).maybeSingle()
      if (error || !club) { upErr = 'not_found'; return }

      const members = club.members || []
      const idx = members.findIndex(m => (m.name || '').toLowerCase() === name.toLowerCase())
      if (idx >= 0) {
        members[idx] = { ...members[idx], progress: progress ?? members[idx].progress, note: note ?? members[idx].note, updatedAt: Date.now() }
      } else {
        members.push({ name, progress: progress || '', note: note || '', updatedAt: Date.now() })
      }

      const { error: err } = await sb.from('book_clubs').update({ members }).eq('id', clubId)
      if (err) { upErr = 'db_error'; console.error(err) }
    })
  } catch (err) { console.error(err); return res.status(500).json({ error: 'DB error' }) }

  if (upErr === 'not_found') return res.status(404).json({ error: 'Club not found' })
  if (upErr === 'db_error') return res.status(500).json({ error: 'DB error' })

  const { data: updated, error: fetchErr } = await sb.from('book_clubs').select('*').eq('id', clubId).maybeSingle()
  if (fetchErr) { console.error(fetchErr); return res.status(500).json({ error: 'DB error' }) }
  if (!updated) return res.status(404).json({ error: 'Club not found' })
  res.json({
    id: updated.id,
    bookId: updated.book_id,
    bookTitle: updated.book_title,
    bookCover: updated.book_cover,
    createdAt: new Date(updated.created_at).getTime(),
    members: updated.members || [],
  })
})

app.listen(PORT, '0.0.0.0', () => console.log(`Review proxy running on port ${PORT}`))
