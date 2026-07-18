import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BookOpen, Clock, CheckCheck, ArrowRight, Sparkles, TrendingUp, Star, CalendarDays, Quote, Wand2 } from 'lucide-react'
import { getShelves, getRecentBooks } from '../lib/shelves'
import { getRandomHighlight } from '../lib/highlights'
import { getAllNotes } from '../lib/notes'
import { getNewBooks, getPopularBooks, getBooksByGenre, shuffled, GENRES, BOOKS } from '../lib/localBooks'
import GoalRing from '../components/GoalRing'
import { c } from '../lib/theme'

const SHELF_META = {
  'currently-reading': { label: 'Currently Reading', icon: BookOpen },
  'want-to-read':      { label: 'Want to Read',      icon: Clock },
  'read':              { label: 'Read',               icon: CheckCheck },
}

function pickRandom(arr, n) {
  return shuffled(arr).slice(0, n)
}

function getForYou(libraryBooks) {
  if (!libraryBooks.length) return null
  const libraryIds = new Set(libraryBooks.map(b => b.id))
  const catCounts = {}
  for (const b of libraryBooks) {
    for (const cat of (b.categories || [])) catCounts[cat] = (catCounts[cat] || 0) + 1
  }
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0])
  const pool = BOOKS.filter(b => !libraryIds.has(b.id) && topCats.some(c => b.categories.includes(c)))
  return pool.length ? pickRandom(pool, 14) : pickRandom(BOOKS.filter(b => !libraryIds.has(b.id)), 14)
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
              <div className="w-full h-full flex items-end p-2" style={{
                background: book.coverHue != null
                  ? `linear-gradient(150deg, hsl(${book.coverHue},35%,22%) 0%, hsl(${book.coverHue},50%,14%) 100%)`
                  : `linear-gradient(135deg, ${c.surface2}, ${c.surface})`,
              }}>
                <span className="text-xs leading-tight" style={{ color: `hsl(${book.coverHue ?? 220},60%,75%)`, fontFamily: '"Lora", serif' }}>{book.title}</span>
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
  const { user, loading: authLoading } = useAuth()
  const [shelves, setShelves] = useState({})
  const [recent, setRecent] = useState([]) // eslint-disable-line no-unused-vars
  const [newBooks, setNewBooks] = useState([])
  const [recommended, setRecommended] = useState([])
  const [forYou, setForYou] = useState(null)
  const [genres, setGenres] = useState([])
  const [randomQuote, setRandomQuote] = useState(null)
  const [aiRec, setAiRec] = useState(null)
  const [aiRecFailed, setAiRecFailed] = useState(false)
  const [loadingAiRec, setLoadingAiRec] = useState(false)
  const thisYear = new Date().getFullYear()

  useEffect(() => {
    if (authLoading) return
    let mounted = true
    Promise.all([getShelves(), getRecentBooks(8), getRandomHighlight()]).then(([sh, recent, quote]) => {
      if (!mounted) return
      setShelves(sh)
      setRecent(recent)
      setRandomQuote(quote)

      const libraryBooks = Object.values(sh).flat()

      // Populate all sections from local data — synchronous, no API needed
      setNewBooks(pickRandom(getNewBooks({ maxResults: 40, minYear: 2022 }), 14))
      setRecommended(pickRandom(getPopularBooks({ maxResults: 40 }), 14))
      setForYou(getForYou(libraryBooks))

      // Pick 4 random genres and populate each with 14 books
      const picked = shuffled(GENRES).slice(0, 4)
      setGenres(picked.map(label => ({
        genre: { label, searchQ: label },
        books: pickRandom(getBooksByGenre(label), 14),
      })))

      // Fire off AI recommendation in parallel (won't block page sections)
      if (libraryBooks.length > 0) {
        setLoadingAiRec(true)
        getAllNotes().catch(() => []).then(notesList => {
          if (!mounted) return
          const notesWithTitles = notesList.map(n => {
            const book = libraryBooks.find(b => b.id === n.bookId)
            return book ? { title: book.title, note: n.text } : null
          }).filter(Boolean)
          try {
            fetch('/api/ai-recommend', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                library: libraryBooks.map(b => ({ title: b.title, authors: b.authors, categories: b.categories })),
                notes: notesWithTitles,
              }),
            })
              .then(r => r.json())
              .then(data => { if (!mounted) return; if (data.recommendation) setAiRec(data.recommendation); else setAiRecFailed(true) })
              .catch(() => { if (mounted) setAiRecFailed(true) })
              .finally(() => { if (mounted) setLoadingAiRec(false) })
          } catch { if (mounted) { setAiRecFailed(true); setLoadingAiRec(false) } }
        })
      }
    })
    return () => { mounted = false }
  }, [authLoading, user?.id ?? null])

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
        {!hasLibrary || forYou === null ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ backgroundColor: c.surface, border: `1px dashed ${c.border}` }}
          >
            <Sparkles size={28} style={{ color: c.textMuted, margin: '0 auto 12px' }} />
            <p style={{ color: c.textSecondary, fontSize: '0.92rem', marginBottom: 6, fontFamily: '"Lora", serif' }}>
              Start adding books to get recommendations
            </p>
            <p style={{ color: c.textMuted, fontSize: '0.8rem' }}>
              We'll suggest titles based on your genres and favorite authors.
            </p>
          </div>
        ) : (
          <BookStrip books={forYou} loading={false} />
        )}
      </section>

      {/* What's New */}
      {newBooks.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            title="What's New"
            icon={TrendingUp}
            to="/search"
            toLabel="Browse all"
          />
          <BookStrip books={newBooks} loading={false} />
        </section>
      )}

      {/* Popular Picks */}
      {recommended.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            title="Popular Picks"
            icon={Sparkles}
            to="/search"
            toLabel="Explore more"
          />
          <BookStrip books={recommended} loading={false} />
        </section>
      )}

      {/* Genre strips */}
      {genres.map(({ genre, books }) => (
        <section key={genre.label} className="mb-10">
          <SectionHeader
            title={genre.label}
            to={`/search?q=${encodeURIComponent(genre.label)}`}
            toLabel="See more"
          />
          <BookStrip books={books} loading={false} />
        </section>
      ))}

    </div>
  )
}
