import { useState, useRef, useCallback } from 'react'
import { Search as SearchIcon, X, Star, ChevronDown, ChevronUp } from 'lucide-react'
import BookCard from '../components/BookCard'
import { searchBooks } from '../lib/googleBooks'
import { c } from '../lib/theme'

const GENRES = [
  { label: 'Fiction', q: 'subject:fiction' },
  { label: 'Literary Fiction', q: 'subject:literary fiction' },
  { label: 'Mystery & Thriller', q: 'subject:mystery' },
  { label: 'Science Fiction', q: 'subject:science fiction' },
  { label: 'Fantasy', q: 'subject:fantasy' },
  { label: 'Biography', q: 'subject:biography' },
  { label: 'History', q: 'subject:history' },
  { label: 'Nature & Environment', q: 'subject:nature' },
  { label: 'Poetry', q: 'subject:poetry' },
  { label: 'Self-Help', q: 'subject:self-help' },
  { label: 'Romance', q: 'subject:romance' },
  { label: 'Young Adult', q: 'subject:young adult' },
]

const RATING_OPTIONS = [
  { label: 'Any rating', value: 0 },
  { label: '4★ and up', value: 4 },
  { label: '3★ and up', value: 3 },
  { label: '2★ and up', value: 2 },
]

const PRICE_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: 'Free ebooks', value: 'free-ebooks' },
  { label: 'Paid ebooks', value: 'paid-ebooks' },
  { label: 'Full preview', value: 'full' },
]

const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Newest first', value: 'newest' },
]

function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${c.border}`, paddingBottom: 4, marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px 0' }}
      >
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.textMuted }}>
          {title}
        </span>
        {open
          ? <ChevronUp size={13} style={{ color: c.textSecondary }} />
          : <ChevronDown size={13} style={{ color: c.textSecondary }} />}
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  )
}

function RadioButton({ checked, onChange, children }) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
      style={{ background: checked ? c.accentBg : 'transparent', border: 'none', cursor: 'pointer' }}
    >
      <span
        style={{
          width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${checked ? c.accent : c.textMuted}`,
          backgroundColor: checked ? c.accent : 'transparent',
          transition: 'all 0.15s',
        }}
      />
      <span style={{ fontSize: '0.82rem', color: checked ? c.accentText : c.textSecondary, fontWeight: checked ? 500 : 400 }}>
        {children}
      </span>
    </button>
  )
}

const PAGE_SIZE = 60
const BATCH = 40
const BATCHES = 10 // 10 × 40 = 400 raw; Google serves ~200 unique, gives us 3+ full pages

function popularityScore(book) {
  if (!book.averageRating) return book.cover ? 0.8 : 0.3
  return book.averageRating * Math.log10((book.ratingsCount ?? 0) + 10)
}

function dedup(books) {
  const seen = new Set()
  return books.filter(b => seen.has(b.id) ? false : seen.add(b.id))
}

function rankBooks(books, sortBy) {
  if (sortBy !== 'relevance') return books
  return [...books].sort((a, b) => popularityScore(b) - popularityScore(a))
}

// Fetch all accessible results in one parallel burst, then rank and store client-side.
// For relevance searches, split batches across two orderings (relevance + newest) so we
// pull different books from Google's index and maximize unique results after dedup.
async function fetchAllBooks(q, extra = {}, sortBy = 'relevance', minRating = 0) {
  const half = BATCHES / 2 // 5 + 5
  let requests
  if (sortBy === 'relevance') {
    // Half with Google's default relevance ordering, half with newest — different result sets
    const byRelevance = Array.from({ length: half }, (_, i) =>
      searchBooks(q, { startIndex: i * BATCH, maxResults: BATCH, ...extra })
    )
    const byNewest = Array.from({ length: half }, (_, i) =>
      searchBooks(q, { startIndex: i * BATCH, maxResults: BATCH, ...extra, orderBy: 'newest' })
    )
    requests = [...byRelevance, ...byNewest]
  } else {
    requests = Array.from({ length: BATCHES }, (_, i) =>
      searchBooks(q, { startIndex: i * BATCH, maxResults: BATCH, ...extra })
    )
  }

  const results = await Promise.allSettled(requests)
  const fulfilled = results.filter(r => r.status === 'fulfilled')
  const raw = fulfilled.flatMap(r => r.value.books)
  const apiTotal = fulfilled[0]?.value.total || 0

  let books = dedup(raw)
  if (minRating > 0) books = books.filter(b => b.averageRating >= minRating)
  books = rankBooks(books, sortBy)

  return { books, apiTotal }
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [allBooks, setAllBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [apiTotal, setApiTotal] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  const [selectedGenre, setSelectedGenre] = useState(null)
  const [minRating, setMinRating] = useState(0)
  const [priceFilter, setPriceFilter] = useState('any')
  const [sortBy, setSortBy] = useState('relevance')

  const inputRef = useRef(null)

  // Derived pagination — purely client-side, no API calls on page change
  const totalPages = Math.ceil(allBooks.length / PAGE_SIZE)
  const books = allBooks.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  function buildQuery() {
    const parts = []
    if (query.trim()) parts.push(query.trim())
    if (selectedGenre) parts.push(selectedGenre.q)
    return parts.join('+') || ''
  }

  function goToPage(pageIndex) {
    setCurrentPage(pageIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const runSearch = useCallback(async () => {
    const q = buildQuery()
    if (!q) return
    const extra = {}
    if (priceFilter !== 'any') extra.filter = priceFilter
    if (sortBy !== 'relevance') extra.orderBy = sortBy
    setLoading(true)
    setCurrentPage(0)
    try {
      const { books, apiTotal } = await fetchAllBooks(q, extra, sortBy, minRating)
      setAllBooks(books)
      setApiTotal(apiTotal)
      setHasSearched(true)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [query, selectedGenre, minRating, priceFilter, sortBy])

  function handleKey(e) {
    if (e.key === 'Enter') runSearch()
  }

  function selectGenre(genre) {
    setSelectedGenre(prev => prev?.q === genre.q ? null : genre)
  }

  function clearAll() {
    setQuery('')
    setSelectedGenre(null)
    setMinRating(0)
    setPriceFilter('any')
    setSortBy('relevance')
    setBooks([])
    setHasSearched(false)
    inputRef.current?.focus()
  }

  const hasActiveFilters = selectedGenre !== null || minRating > 0 || priceFilter !== 'any' || sortBy !== 'relevance'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-7">
        <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1.75rem', marginBottom: '0.2rem' }}>
          Discover books
        </h1>
        <p style={{ color: c.textSecondary, fontSize: '0.875rem' }}>
          Filter by genre, rating, or availability — then hit Search.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <div
          className="flex items-center gap-3 rounded-xl px-4 flex-1"
          style={{
            backgroundColor: c.surface,
            border: `1.5px solid ${c.border}`,
            height: 50,
          }}
        >
          <SearchIcon size={16} style={{ color: c.textMuted, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Title, author, ISBN…"
            className="flex-1 bg-transparent outline-none"
            style={{ color: c.textPrimary, fontSize: '0.9rem' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={runSearch}
          disabled={loading || (!query.trim() && !hasActiveFilters)}
          className="flex items-center gap-2 px-6 rounded-xl text-sm font-medium transition-all"
          style={{
            backgroundColor: (loading || (!query.trim() && !hasActiveFilters)) ? c.surface2 : c.btnPrimary,
            color: (loading || (!query.trim() && !hasActiveFilters)) ? c.textMuted : c.btnPrimaryText,
            border: 'none',
            cursor: (loading || (!query.trim() && !hasActiveFilters)) ? 'default' : 'pointer',
            height: 50,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <SearchIcon size={15} />
          )}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Active chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <span style={{ fontSize: '0.72rem', color: c.textMuted, marginRight: 2, fontWeight: 500 }}>Active:</span>
          {selectedGenre && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: c.accentBg, color: c.accentText }}>
              {selectedGenre.label}
              <button onClick={() => setSelectedGenre(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: c.textSecondary, marginLeft: 1 }}>
                <X size={10} />
              </button>
            </span>
          )}
          {minRating > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: c.warmBg, color: c.warmText }}>
              {minRating}★ & up
              <button onClick={() => setMinRating(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: c.textSecondary, marginLeft: 1 }}>
                <X size={10} />
              </button>
            </span>
          )}
          {priceFilter !== 'any' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: c.warmBg, color: c.warmText }}>
              {PRICE_OPTIONS.find(p => p.value === priceFilter)?.label}
              <button onClick={() => setPriceFilter('any')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: c.textSecondary, marginLeft: 1 }}>
                <X size={10} />
              </button>
            </span>
          )}
          <button onClick={clearAll} style={{ fontSize: '0.72rem', color: c.textSecondary, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 2, textDecoration: 'underline' }}>
            Clear all
          </button>
        </div>
      )}

      {/* Layout: sidebar + results */}
      <div className="flex gap-8">

        {/* Sidebar */}
        <aside style={{ width: 210, flexShrink: 0 }}>
          <div className="sticky top-20">
            <div style={{
              backgroundColor: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: '20px 16px',
            }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.textMuted, marginBottom: 18 }}>
                Filters
              </p>

              <FilterSection title="Genre">
                <div className="flex flex-col">
                  {GENRES.map(g => (
                    <RadioButton
                      key={g.q}
                      checked={selectedGenre?.q === g.q}
                      onChange={() => selectGenre(g)}
                    >
                      {g.label}
                    </RadioButton>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Min. Rating">
                <div className="flex flex-col">
                  {RATING_OPTIONS.map(opt => (
                    <RadioButton key={opt.value} checked={minRating === opt.value} onChange={() => setMinRating(opt.value)}>
                      {opt.value > 0 ? (
                        <span className="flex items-center gap-1">
                          {Array.from({ length: opt.value }).map((_, i) => (
                            <Star key={i} size={11} fill={c.star} stroke="none" />
                          ))}
                          <span style={{ color: 'inherit' }}>&amp; up</span>
                        </span>
                      ) : 'Any rating'}
                    </RadioButton>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Availability">
                <div className="flex flex-col">
                  {PRICE_OPTIONS.map(opt => (
                    <RadioButton key={opt.value} checked={priceFilter === opt.value} onChange={() => setPriceFilter(opt.value)}>
                      {opt.label}
                    </RadioButton>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Sort By" defaultOpen={false}>
                <div className="flex flex-col">
                  {SORT_OPTIONS.map(opt => (
                    <RadioButton key={opt.value} checked={sortBy === opt.value} onChange={() => setSortBy(opt.value)}>
                      {opt.label}
                    </RadioButton>
                  ))}
                </div>
              </FilterSection>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">

          {/* Idle */}
          {!hasSearched && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <SearchIcon size={38} style={{ color: c.textMuted, marginBottom: 14 }} />
              <p style={{ fontFamily: '"Lora", serif', fontSize: '1.05rem', color: c.textSecondary, marginBottom: 6 }}>
                Set your filters and hit Search
              </p>
              <p style={{ fontSize: '0.82rem', color: c.textMuted }}>
                Or just type a title, author, or ISBN above.
              </p>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))' }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="rounded-xl animate-pulse" style={{ width: '100%', aspectRatio: '2/3', backgroundColor: c.surface2 }} />
                  <div className="rounded animate-pulse" style={{ height: 10, width: '80%', backgroundColor: c.surface2 }} />
                  <div className="rounded animate-pulse" style={{ height: 8, width: '55%', backgroundColor: c.surface }} />
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {hasSearched && !loading && books.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <SearchIcon size={34} style={{ color: c.textMuted, marginBottom: 12 }} />
              <p style={{ fontFamily: '"Lora", serif', fontSize: '1rem', color: c.textSecondary }}>No results found</p>
              <p style={{ fontSize: '0.82rem', color: c.textMuted, marginTop: 6 }}>Try adjusting your filters or broadening your search.</p>
            </div>
          )}

          {/* Results */}
          {!loading && books.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-5">
                <p style={{ fontSize: '0.78rem', color: c.textSecondary }}>
                  <span style={{ color: c.textPrimary, fontWeight: 500 }}>{allBooks.length}</span> books found
                  {apiTotal > allBooks.length && <span> · {apiTotal.toLocaleString()} in catalog</span>}
                </p>
                {totalPages > 1 && (
                  <p style={{ fontSize: '0.78rem', color: c.textSecondary }}>
                    Page <span style={{ color: c.textPrimary, fontWeight: 500 }}>{currentPage + 1}</span> of {totalPages}
                  </p>
                )}
              </div>
              <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))' }}>
                {books.map(book => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>

              {/* Pagination — client-side only, no API calls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="px-5 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: c.surface,
                      color: currentPage === 0 ? c.textMuted : c.accentText,
                      border: `1.5px solid ${currentPage === 0 ? c.border : c.accent}`,
                      cursor: currentPage === 0 ? 'default' : 'pointer',
                    }}
                  >
                    ← Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page = i
                      if (totalPages > 7) {
                        const start = Math.max(0, Math.min(currentPage - 3, totalPages - 7))
                        page = start + i
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => goToPage(page)}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', border: 'none',
                            cursor: 'pointer', fontSize: '0.8rem', fontWeight: page === currentPage ? 600 : 400,
                            backgroundColor: page === currentPage ? c.btnPrimary : 'transparent',
                            color: page === currentPage ? c.btnPrimaryText : c.textSecondary,
                          }}
                        >
                          {page + 1}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="px-5 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: c.surface,
                      color: currentPage >= totalPages - 1 ? c.textMuted : c.accentText,
                      border: `1.5px solid ${currentPage >= totalPages - 1 ? c.border : c.accent}`,
                      cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
