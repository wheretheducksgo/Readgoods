import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Clock, CheckCheck, ArrowRight, Sparkles, TrendingUp, Star, CalendarDays, Quote, Wand2 } from 'lucide-react'
import { getShelves, getRecentBooks } from '../lib/shelves'
import { searchBooks } from '../lib/googleBooks'
import { getRandomHighlight } from '../lib/highlights'
import GoalRing from '../components/GoalRing'

function getNotesMap() {
  try { return JSON.parse(localStorage.getItem('readgoods_notes') || '{}') } catch { return {} }
}
import { c } from '../lib/theme'

const SHELF_META = {
  'currently-reading': { label: 'Currently Reading', icon: BookOpen },
  'want-to-read':      { label: 'Want to Read',      icon: Clock },
  'read':              { label: 'Read',               icon: CheckCheck },
}

const ALL_GENRES = [
  { label: 'Fantasy & Magic',       query: 'subject:fantasy',                  searchQ: 'subject:fantasy' },
  { label: 'Mystery & Thriller',    query: 'subject:mystery',                  searchQ: 'subject:mystery' },
  { label: 'Science Fiction',       query: 'subject:science fiction',          searchQ: 'subject:science fiction' },
  { label: 'Historical Fiction',    query: 'subject:historical fiction',       searchQ: 'subject:historical fiction' },
  { label: 'Romance',               query: 'subject:romance',                  searchQ: 'subject:romance' },
  { label: 'Horror',                query: 'subject:horror',                   searchQ: 'subject:horror' },
  { label: 'Biography & Memoir',    query: 'subject:biography',               searchQ: 'subject:biography' },
  { label: 'True Crime',            query: 'true crime murder investigation',  searchQ: 'true crime' },
  { label: 'Graphic Novels',        query: 'subject:comics graphic novel',     searchQ: 'subject:comics' },
  { label: 'Short Stories',         query: 'subject:fiction short stories anthology', searchQ: 'subject:short stories' },
  { label: 'Poetry',                query: 'subject:poetry',                   searchQ: 'subject:poetry' },
  { label: 'Adventure',             query: 'subject:adventure',                searchQ: 'subject:adventure' },
  { label: 'Self-Help',             query: 'subject:self-help personal development', searchQ: 'subject:self-help' },
  { label: 'Travel',                query: 'subject:travel writing',           searchQ: 'subject:travel' },
]

function pickGenres(n = 4) {
  const shuffled = [...ALL_GENRES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// Deduplicate books by id
function dedup(books) {
  const seen = new Set()
  return books.filter(b => !seen.has(b.id) && seen.add(b.id))
}

function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

// localStorage cache with 2-hour TTL for API results
const CACHE_TTL = 24 * 60 * 60 * 1000
function scGet(key) {
  try {
    const v = localStorage.getItem(`hc:${key}`)
    if (!v) return null
    const { data, exp } = JSON.parse(v)
    if (Date.now() > exp) { localStorage.removeItem(`hc:${key}`); return null }
    return data
  } catch { return null }
}
function scSet(key, data) {
  try { localStorage.setItem(`hc:${key}`, JSON.stringify({ data, exp: Date.now() + CACHE_TTL })) } catch {}
}

async function fetchNew() {
  const cached = scGet('home:new')
  if (cached) return pickRandom(cached, 14)

  const results = await Promise.allSettled([
    searchBooks('subject:thriller', { maxResults: 30, orderBy: 'newest' }),
    searchBooks('subject:"contemporary fiction"', { maxResults: 30, orderBy: 'newest' }),
  ])
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value.books : [])
  const REPRINT = /\b(illustrated|annotated|unabridged|abridged|classics?( edition)?|collector'?s|complete works?|definitive edition|library edition|retold|adapted)\b/i
  const deduped = dedup(all)
  const pool = deduped.filter(b => {
    const year = parseInt(b.publishedDate?.slice(0, 4), 10)
    return !isNaN(year) && year >= 2022 && !REPRINT.test(b.title)
  })
  // Fall back to unfiltered if the strict filter removes everything
  const final = (pool.length >= 7 ? pool : deduped).slice(0, 60)
  if (final.length) scSet('home:new', final)
  return pickRandom(final, 14)
}

async function fetchPopular() {
  const cached = scGet('home:popular')
  if (cached) { return pickRandom(cached, 14) }

  const [r1, r2] = await Promise.allSettled([
    searchBooks('subject:fiction', { maxResults: 40 }),
    searchBooks('subject:fiction', { maxResults: 40, startIndex: 40 }),
  ])
  const all = [
    ...(r1.status === 'fulfilled' ? r1.value.books : []),
    ...(r2.status === 'fulfilled' ? r2.value.books : []),
  ]
  const pool = dedup(all)
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
    .slice(0, 60)
  if (pool.length) scSet('home:popular', pool)
  return pickRandom(pool, 14)
}

async function fetchForYou(libraryBooks) {
  if (!libraryBooks.length) return null

  const cacheKey = `home:foryou:${libraryBooks.map(b => b.id).sort().join(',')}`
  const cached = scGet(cacheKey)
  if (cached) return pickRandom(cached, 14)

  const libraryIds = new Set(libraryBooks.map(b => b.id))
  const catCounts = {}, authCounts = {}
  for (const b of libraryBooks) {
    for (const cat of (b.categories || [])) catCounts[cat] = (catCounts[cat] || 0) + 1
    const auth = b.authors?.[0]
    if (auth) authCounts[auth] = (authCounts[auth] || 0) + 1
  }
  // Limit to top 2 categories + top 1 author to keep calls low
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0])
  const topAuth = Object.entries(authCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  const queries = [
    ...topCats.map(cat => searchBooks(`subject:"${cat}"`, { maxResults: 20 })),
    ...(topAuth ? [searchBooks(`inauthor:"${topAuth}"`, { maxResults: 20 })] : []),
  ]
  const results = await Promise.allSettled(queries)
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value.books : [])
  const pool = dedup(all).filter(b => !libraryIds.has(b.id))
  if (pool.length) scSet(cacheKey, pool)
  return pool.length ? pickRandom(pool, 14) : null
}

async function fetchGenre(query) {
  const cached = scGet(`home:genre:${query}`)
  if (cached) return pickRandom(cached, 14)

  const { books } = await searchBooks(query, { maxResults: 40 })
  const pool = dedup(books)
  if (pool.length) scSet(`home:genre:${query}`, pool)
  return pool.slice(0, 14)
}

// ── Horizontal book strip ─────────────────────────────────────────────────────

function BookStrip({ books, loading }) {
  const rowRef = useRef(null)
  const COVER_W = 96
  const COVER_H = 144

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg flex-shrink-0 animate-pulse"
            style={{ width: COVER_W, height: COVER_H, backgroundColor: c.surface2 }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      ref={rowRef}
      className="flex gap-4 overflow-x-auto pb-2"
      style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {books.map(book => (
        <Link
          key={book.id}
          to={`/book/${book.id}`}
          className="flex-shrink-0 group"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div
            className="rounded-lg overflow-hidden transition-transform group-hover:scale-[1.03]"
            style={{ width: COVER_W, height: COVER_H, backgroundColor: c.surface2, boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}
          >
            {book.cover ? (
              <img src={book.cover} alt={book.title} width={COVER_W} height={COVER_H} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-end p-2" style={{ background: `linear-gradient(135deg, ${c.surface2}, ${c.surface})` }}>
                <span className="text-xs leading-tight" style={{ color: c.accentText, fontFamily: '"Lora", serif' }}>{book.title}</span>
              </div>
            )}
          </div>
          <div className="mt-1.5" style={{ width: COVER_W }}>
            <p className="text-xs font-medium line-clamp-2 leading-snug" style={{ color: c.textPrimary, fontFamily: '"Lora", serif' }}>
              {book.title}
            </p>
            {book.averageRating && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <Star size={9} fill={c.star} stroke="none" />
                <span style={{ fontSize: '0.68rem', color: c.warm }}>{book.averageRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function SectionHeader({ title, icon: Icon, to, toLabel = 'See all' }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="flex items-center gap-2" style={{ fontFamily: '"Lora", serif', fontSize: '1.1rem', fontWeight: 600, color: c.textPrimary }}>
        {Icon && <Icon size={15} style={{ color: c.accentText }} />}
        {title}
      </h2>
      {to && (
        <Link to={to} className="flex items-center gap-1 text-xs" style={{ color: c.textSecondary }}>
          {toLabel} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [shelves, setShelves] = useState({})
  const [recent, setRecent] = useState([])
  const [newBooks, setNewBooks] = useState([])
  const [recommended, setRecommended] = useState([])
  const [forYou, setForYou] = useState(null)
  const [genres, setGenres] = useState(() => Array.from({ length: 4 }, () => []))
  const [selectedGenres] = useState(() => pickGenres(4))
  const [loadingNew, setLoadingNew] = useState(true)
  const [loadingRec, setLoadingRec] = useState(true)
  const [loadingForYou, setLoadingForYou] = useState(true)
  const [loadingGenres, setLoadingGenres] = useState(true)
  const [randomQuote, setRandomQuote] = useState(null)
  const [aiRec, setAiRec] = useState(null)
  const [aiRecFailed, setAiRecFailed] = useState(false)
  const [loadingAiRec, setLoadingAiRec] = useState(false)
  const thisYear = new Date().getFullYear()

  useEffect(() => {
    const sh = getShelves()
    setShelves(sh)
    setRecent(getRecentBooks(8))
    setRandomQuote(getRandomHighlight())

    const libraryBooks = Object.values(sh).flat()

    // Fire off AI recommendation in parallel (won't block page sections)
    if (libraryBooks.length > 0) {
      setLoadingAiRec(true)
      const notes = getNotesMap()
      const notesList = Object.entries(notes).map(([bookId, v]) => {
        const book = libraryBooks.find(b => b.id === bookId)
        return book ? { title: book.title, note: v.text } : null
      }).filter(Boolean)
      fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          library: libraryBooks.map(b => ({ title: b.title, authors: b.authors, categories: b.categories })),
          notes: notesList,
        }),
      })
        .then(r => r.json())
        .then(data => { if (data.recommendation) setAiRec(data.recommendation); else setAiRecFailed(true) })
        .catch(() => setAiRecFailed(true))
        .finally(() => setLoadingAiRec(false))
    }

    // Load sections serially. Only pause between sections when an API call is needed
    // (cache hits are instant and don't count against rate limits).
    const delay = ms => new Promise(r => setTimeout(r, ms))
    const needsDelay = key => !scGet(key)

    ;(async () => {
      try { setRecommended(await fetchPopular()) } catch {}
      setLoadingRec(false)

      if (needsDelay('home:new')) await delay(800)
      try { setNewBooks(await fetchNew()) } catch {}
      setLoadingNew(false)

      const fyKey = `home:foryou:${libraryBooks.map(b => b.id).sort().join(',')}`
      if (needsDelay(fyKey)) await delay(800)
      try { setForYou(await fetchForYou(libraryBooks)) } catch {}
      setLoadingForYou(false)

      const genreResults = []
      for (const genre of selectedGenres) {
        if (needsDelay(`home:genre:${genre.query}`)) await delay(800)
        try { genreResults.push(await fetchGenre(genre.query)) }
        catch { genreResults.push([]) }
        setGenres([...genreResults, ...Array(selectedGenres.length - genreResults.length).fill([])])
      }
      setLoadingGenres(false)
    })()
  }, [])

  const counts = {
    'currently-reading': shelves['currently-reading']?.length || 0,
    'want-to-read':      shelves['want-to-read']?.length || 0,
    'read':              shelves['read']?.length || 0,
  }
  const hasLibrary = Object.values(shelves).flat().length > 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '2rem', marginBottom: '0.3rem' }}>
          Your reading life
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <p style={{ color: c.textSecondary, fontSize: '0.95rem' }}>
            Track what you've read, discover what's next.
          </p>
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <GoalRing year={thisYear} booksRead={counts['read']} />
            <Link
              to={`/year-in-review/${thisYear}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: c.accentBg, color: c.accentText, border: `1px solid ${c.border}` }}
            >
              <CalendarDays size={12} /> {thisYear} in Review
            </Link>
          </div>
        </div>
      </div>

      {/* Shelf stats */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {Object.entries(SHELF_META).map(([id, { label, icon: Icon }]) => (
          <Link
            key={id}
            to={`/shelf/${id}`}
            className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-opacity-80"
            style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}
          >
            <Icon size={18} style={{ color: c.accentText }} />
            <span style={{ fontFamily: '"Lora", serif', fontSize: '1.75rem', fontWeight: 600, color: c.textPrimary, lineHeight: 1 }}>
              {counts[id]}
            </span>
            <span style={{ fontSize: '0.78rem', color: c.textSecondary, letterSpacing: '0.02em' }}>{label}</span>
          </Link>
        ))}
      </div>

      {/* Random highlight quote */}
      {randomQuote && (
        <div
          className="rounded-xl px-6 py-5 mb-10 flex gap-4 items-start"
          style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}
        >
          <Quote size={18} style={{ color: c.accentText, flexShrink: 0, marginTop: 2 }} />
          <div className="min-w-0">
            <p style={{ fontFamily: '"Lora", serif', fontStyle: 'italic', color: c.textPrimary, fontSize: '0.95rem', lineHeight: 1.65 }}>
              "{randomQuote.text}"
            </p>
            {randomQuote.page && (
              <p style={{ color: c.textMuted, fontSize: '0.75rem', marginTop: 4 }}>p. {randomQuote.page}</p>
            )}
          </div>
        </div>
      )}

      {/* AI "What to read next" */}
      {hasLibrary && (
        <div
          className="rounded-xl px-6 py-5 mb-10 flex gap-4 items-start"
          style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}` }}
        >
          <Wand2 size={18} style={{ color: c.accentText, flexShrink: 0, marginTop: 2 }} />
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted, marginBottom: 6 }}>
              AI Pick — What to read next
            </p>
            {loadingAiRec ? (
              <div className="animate-pulse">
                <div className="h-4 w-48 rounded mb-2" style={{ backgroundColor: c.surface2 }} />
                <div className="h-3 w-64 rounded" style={{ backgroundColor: c.surface2 }} />
              </div>
            ) : aiRec ? (
              <>
                <p style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1rem', marginBottom: 2 }}>
                  {aiRec.title}
                </p>
                <p style={{ color: c.textSecondary, fontSize: '0.82rem', marginBottom: 8 }}>by {aiRec.author}</p>
                <p style={{ color: c.textSecondary, fontSize: '0.85rem', lineHeight: 1.6 }}>{aiRec.reason}</p>
                <Link
                  to={`/search?q=${encodeURIComponent(aiRec.title + ' ' + aiRec.author)}`}
                  className="inline-flex items-center gap-1 mt-3 text-xs"
                  style={{ color: c.accentText }}
                >
                  Find it <ArrowRight size={11} />
                </Link>
              </>
            ) : (
              <p style={{ color: c.textSecondary, fontSize: '0.88rem' }}>
                AI recommendations unavailable right now. Personalized picks will appear here once the account has credits.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Currently reading strip */}
      {shelves['currently-reading']?.length > 0 && (
        <section className="mb-10">
          <SectionHeader title="Currently Reading" icon={BookOpen} to="/shelf/currently-reading" />
          <BookStrip books={shelves['currently-reading'].slice(0, 10)} loading={false} />
        </section>
      )}

      {/* Empty state */}
      {!hasLibrary && (
        <div
          className="rounded-2xl p-12 text-center mb-10"
          style={{ backgroundColor: c.surface, border: `1px dashed ${c.border}` }}
        >
          <BookOpen size={34} style={{ color: c.textMuted, margin: '0 auto 14px' }} />
          <h3 style={{ fontFamily: '"Lora", serif', color: c.textSecondary, marginBottom: 8, fontSize: '1.1rem' }}>
            Your shelves are empty
          </h3>
          <p style={{ color: c.textMuted, fontSize: '0.88rem', marginBottom: 20 }}>
            Search for a book and add it to get started.
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText }}
          >
            Browse books
          </Link>
        </div>
      )}

      {/* For You */}
      <section className="mb-10">
        <SectionHeader title="For You" icon={Sparkles} />
        {loadingForYou && hasLibrary ? (
          <BookStrip books={[]} loading={true} />
        ) : !hasLibrary || forYou === null ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ backgroundColor: c.surface, border: `1px dashed ${c.border}` }}
          >
            <Sparkles size={28} style={{ color: c.textMuted, margin: '0 auto 12px' }} />
            <p style={{ color: c.textSecondary, fontSize: '0.92rem', marginBottom: 6, fontFamily: '"Lora", serif' }}>
              Start adding books to get recommendations
            </p>
            <p style={{ color: c.textMuted, fontSize: '0.8rem' }}>
              We'll suggest titles based on your genres and favourite authors.
            </p>
          </div>
        ) : (
          <BookStrip books={forYou} loading={false} />
        )}
      </section>

      {/* What's New */}
      <section className="mb-10">
        <SectionHeader
          title="What's New"
          icon={TrendingUp}
          to="/search?q=subject:fiction&orderBy=newest"
          toLabel="Browse new releases"
        />
        <BookStrip books={newBooks} loading={loadingNew} />
      </section>

      {/* Recommended for You */}
      <section className="mb-10">
        <SectionHeader
          title="Popular Picks"
          icon={Sparkles}
          to="/search"
          toLabel="Explore more"
        />
        <BookStrip books={recommended} loading={loadingRec} />
      </section>

      {/* Genre strips */}
      {selectedGenres.map((genre, i) => (
        <section key={genre.label} className="mb-10">
          <SectionHeader
            title={genre.label}
            to={`/search?q=${encodeURIComponent(genre.searchQ)}`}
            toLabel="See more"
          />
          <BookStrip books={genres[i]} loading={loadingGenres} />
        </section>
      ))}

    </div>
  )
}
