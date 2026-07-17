import { useState, useRef, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Search as SearchIcon, X, Star, ChevronDown, ChevronUp } from 'lucide-react'
import BookCard from '../components/BookCard'
import { searchBooks, GENRES as ALL_GENRES, getPopularBooks } from '../lib/localBooks'
import { c } from '../lib/theme'

const GENRES = ALL_GENRES.map(g => ({ label: g, q: g }))

const RATING_OPTIONS = [
  { label: 'Any rating', value: 0 },
  { label: '4★ and up', value: 4 },
  { label: '3★ and up', value: 3 },
  { label: '2★ and up', value: 2 },
]

const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Highest rated', value: 'rating' },
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

function runLocalSearch(q, genreLabel, minRating, sortBy) {
  const { books: textResults } = q.trim()
    ? searchBooks(q.trim())
    : { books: [] }

  const genreResults = genreLabel
    ? searchBooks(genreLabel).books
    : []

  let books
  if (q.trim() && genreLabel) {
    const genreIds = new Set(genreResults.map(b => b.id))
    books = textResults.filter(b => genreIds.has(b.id))
  } else if (genreLabel) {
    books = genreResults
  } else if (q.trim()) {
    books = textResults
  } else {
    books = getPopularBooks({ maxResults: 100 })
  }

  if (minRating > 0) books = books.filter(b => (b.averageRating || 0) >= minRating)

  if (sortBy === 'rating') {
    books = [...books].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
  } else if (sortBy === 'newest') {
    books = [...books].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
  }

  return books
}

const PAGE_SIZE = 60

export default function Search() {
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [allBooks, setAllBooks] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  const [selectedGenre, setSelectedGenre] = useState(null)
  const [minRating, setMinRating] = useState(0)
  const [sortBy, setSortBy] = useState('relevance')

  const inputRef = useRef(null)

  // Derived pagination — purely client-side
  const totalPages = Math.ceil(allBooks.length / PAGE_SIZE)
  const books = allBooks.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  // Seed query from URL ?q= param on mount
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q')
    if (q) {
      setQuery(q)
      const results = runLocalSearch(q, null, 0, 'relevance')
      setAllBooks(results)
      setHasSearched(true)
    }
  }, [])

  function goToPage(pageIndex) {
    setCurrentPage(pageIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const runSearch = useCallback(() => {
    if (!query.trim() && !selectedGenre) return
    const results = runLocalSearch(query, selectedGenre?.q || null, minRating, sortBy)
    setAllBooks(results)
    setCurrentPage(0)
    setHasSearched(true)
  }, [query, selectedGenre, minRating, sortBy])

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
    setSortBy('relevance')
    setAllBooks([])
    setHasSearched(false)
    inputRef.current?.focus()
  }

  const hasActiveFilters = selectedGenre !== null || minRating > 0 || sortBy !== 'relevance'

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
          disabled={!query.trim() && !hasActiveFilters}
          className="flex items-center gap-2 px-6 rounded-xl text-sm font-medium transition-all"
          style={{
            backgroundColor: (!query.trim() && !hasActiveFilters) ? c.surface2 : c.btnPrimary,
            color: (!query.trim() && !hasActiveFilters) ? c.textMuted : c.btnPrimaryText,
            border: 'none',
            cursor: (!query.trim() && !hasActiveFilters) ? 'default' : 'pointer',
            height: 50,
            whiteSpace: 'nowrap',
          }}
        >
          <SearchIcon size={15} />
          Search
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
          {!hasSearched && (
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

          {/* No results */}
          {hasSearched && books.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <SearchIcon size={34} style={{ color: c.textMuted, marginBottom: 12 }} />
              <p style={{ fontFamily: '"Lora", serif', fontSize: '1rem', color: c.textSecondary }}>No results found</p>
              <p style={{ fontSize: '0.82rem', color: c.textMuted, marginTop: 6 }}>Try adjusting your filters or broadening your search.</p>
            </div>
          )}

          {/* Results */}
          {books.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-5">
                <p style={{ fontSize: '0.78rem', color: c.textSecondary }}>
                  <span style={{ color: c.textPrimary, fontWeight: 500 }}>{allBooks.length}</span> books found
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

    </div>
  )
}
