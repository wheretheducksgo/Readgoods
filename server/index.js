import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const PORT = process.env.PORT || 3001

app.use((req, res, next) => {
  const origin = req.headers.origin || ''
  const allowed = origin === 'http://localhost:5173' || /\.vercel\.app$/.test(origin)
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
function cacheSet(key, data) {
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
          if (!key.startsWith('series-books2:')) continue
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

// GET /api/series/books?seriesName=&seriesKey=
// Returns all books in a series with their positions, using OL subject tag search.
app.get('/api/series/books', async (req, res) => {
  const { seriesName, seriesKey } = req.query
  if (!seriesName && !seriesKey) return res.status(400).json({ error: 'Provide seriesName or seriesKey' })

  const cacheKey = `series-books2:${seriesName || seriesKey}`
  const cached = cacheGet(cacheKey)
  if (cached) return res.json(cached)

  try {
    // Derive OL subject slug: "Percy Jackson & the Olympians" → "Serie:Percy_Jackson_and_the_Olympians"
    const slug = (seriesName || '')
      .replace(/\s*&\s*/g, '_and_')
      .replace(/\s+/g, '_')
    const subject = `Serie:${slug}`

    const r = await ol.get('/search.json', {
      params: {
        q: `subject:"${subject}"`,
        fields: 'key,title,first_publish_year,cover_i',
        limit: 12,
      },
    })
    const docs = r.data.docs || []

    // Deduplicate by normalized title, keep earliest year per title
    const byTitle = new Map()
    for (const d of docs) {
      const key = d.title?.toLowerCase().trim()
      if (!key) continue
      const existing = byTitle.get(key)
      if (!existing || (d.first_publish_year && (!existing.first_publish_year || d.first_publish_year < existing.first_publish_year))) {
        byTitle.set(key, d)
      }
    }
    const unique = [...byTitle.values()]

    // Fetch each work's actual series position in parallel (best-effort, 8s per call)
    const withPositions = await Promise.allSettled(
      unique.map(async (d, i) => {
        let position = null
        try {
          const wr = await ol.get(`${d.key}.json`, { timeout: 8000 })
          const entry = wr.data?.series?.[0]
          position = entry?.position ? parseFloat(entry.position) : null
        } catch {}
        return {
          title: d.title,
          year: d.first_publish_year || null,
          position,
          cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
          olKey: d.key,
          yearIndex: i,
        }
      })
    )

    const resolved = withPositions
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)

    // For any that failed to get a position, fall back to year-then-title order
    const anyHasPosition = resolved.some(b => b.position !== null)
    if (anyHasPosition) {
      resolved.sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    } else {
      resolved.sort((a, b) => {
        const yd = (a.year || 9999) - (b.year || 9999)
        return yd !== 0 ? yd : (a.title || '').localeCompare(b.title || '')
      })
    }
    const books = resolved.map((b, i) => ({ ...b, position: b.position ?? (i + 1) }))

    cacheSet(cacheKey, books)
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

const clubs = new Map()

function makeId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// POST /api/club — create a new club
app.post('/api/club', (req, res) => {
  const { bookId, bookTitle, bookCover, creatorName } = req.body
  if (!bookId || !bookTitle || !creatorName) return res.status(400).json({ error: 'Missing fields' })
  const id = makeId()
  clubs.set(id, {
    id, bookId, bookTitle, bookCover: bookCover || null,
    createdAt: Date.now(),
    members: [{ name: creatorName, progress: '', note: '', updatedAt: Date.now() }],
  })
  res.json({ clubId: id })
})

// GET /api/club/:id — fetch club data
app.get('/api/club/:id', (req, res) => {
  const club = clubs.get(req.params.id.toUpperCase())
  if (!club) return res.status(404).json({ error: 'Club not found' })
  res.json(club)
})

// POST /api/club/:id/update — upsert a member's progress/note
app.post('/api/club/:id/update', (req, res) => {
  const club = clubs.get(req.params.id.toUpperCase())
  if (!club) return res.status(404).json({ error: 'Club not found' })
  const { name, progress, note } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const existing = club.members.find(m => m.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    existing.progress = progress ?? existing.progress
    existing.note = note ?? existing.note
    existing.updatedAt = Date.now()
  } else {
    club.members.push({ name, progress: progress || '', note: note || '', updatedAt: Date.now() })
  }
  res.json(club)
})

app.listen(PORT, '0.0.0.0', () => console.log(`Review proxy running on port ${PORT}`))
