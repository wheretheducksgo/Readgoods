import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, X } from 'lucide-react'
import { getCommunityBooks, getAllCommunityTags } from '../lib/community'
import { useAuth } from '../context/AuthContext'
import { c } from '../lib/theme'

function StarDisplay({ rating, size = 12 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={i <= Math.round(rating) ? c.star : 'none'}
          stroke={i <= Math.round(rating) ? c.star : c.textMuted}
        />
      ))}
    </div>
  )
}

function BookCard({ book }) {
  return (
    <Link
      to={`/book/${book.book_id}`}
      className="rounded-xl overflow-hidden flex flex-col group"
      style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, transition: 'border-color 0.15s' }}
    >
      {/* Cover */}
      <div style={{ height: 160, backgroundColor: c.surface2, flexShrink: 0, overflow: 'hidden' }}>
        {book.cover ? (
          <img src={book.cover} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-end p-3" style={{
            background: book.coverHue != null
              ? `linear-gradient(150deg, hsl(${book.coverHue},35%,22%) 0%, hsl(${book.coverHue},50%,14%) 100%)`
              : `linear-gradient(135deg, ${c.surface2}, ${c.surface})`,
          }}>
            <span style={{ fontFamily: '"Lora", serif', fontSize: '0.75rem', color: `hsl(${book.coverHue ?? 220},60%,75%)` }}>{book.title}</span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: c.textPrimary, fontFamily: '"Lora", serif' }}>
          {book.title}
        </p>
        {book.author && (
          <p className="text-xs" style={{ color: c.textSecondary }}>{book.author}</p>
        )}

        {/* Rating */}
        {book.avgRating != null && (
          <div className="flex items-center gap-1.5 mt-auto pt-1">
            <StarDisplay rating={book.avgRating} />
            <span style={{ fontSize: '0.72rem', color: c.warm }}>{book.avgRating.toFixed(1)}</span>
            <span style={{ fontSize: '0.7rem', color: c.textMuted }}>({book.ratingCount})</span>
          </div>
        )}

        {/* Mood tags */}
        {book.moods.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {book.moods.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: c.accentBg, color: c.accentText }}>
                {tag}
              </span>
            ))}
            {book.moods.length > 3 && (
              <span style={{ fontSize: '0.65rem', color: c.textMuted, paddingTop: 2 }}>+{book.moods.length - 3}</span>
            )}
          </div>
        )}

        {/* Review preview */}
        {book.reviews[0] && (
          <p className="text-xs italic line-clamp-2 mt-1" style={{ color: c.textMuted }}>
            "{book.reviews[0]}"
          </p>
        )}
      </div>
    </Link>
  )
}

export default function Community() {
  const { loading: authLoading, user } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [allTags, setAllTags] = useState([])
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(50)

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (authLoading) return
    getAllCommunityTags().then(setAllTags)
  }, [authLoading, user?.id ?? null])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    getCommunityBooks({ query: debouncedQuery, tags: activeTags, minRating })
      .then(results => { if (!cancelled) { setBooks(results); setVisibleCount(50); setLoading(false) } })
      .catch(() => { if (!cancelled) { setBooks([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [authLoading, user?.id ?? null, debouncedQuery, activeTags, minRating])

  function toggleTag(tag) {
    setActiveTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])
  }

  function addTagFromInput() {
    const tag = tagInput.trim()
    if (!tag || activeTags.includes(tag)) { setTagInput(''); return }
    setActiveTags(t => [...t, tag])
    setTagInput('')
  }

  const filteredSuggestions = tagInput.trim()
    ? allTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !activeTags.includes(t))
    : allTags.filter(t => !activeTags.includes(t))

  const hasFilters = query || activeTags.length > 0 || minRating > 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 700, color: c.textPrimary, fontSize: '2rem', marginBottom: 6 }}>
          Readgoods Community
        </h1>
        <p style={{ color: c.textSecondary, fontSize: '0.95rem' }}>
          Books rated and tagged by Readgoods readers.
        </p>
      </div>

      {/* Search + filters */}
      <div className="rounded-2xl p-5 mb-8" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.textMuted }} />
          <input
            type="text"
            placeholder="Search by title or author…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: c.surface2,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              color: c.textPrimary,
              fontSize: '0.9rem',
              padding: '9px 12px 9px 36px',
              outline: 'none',
            }}
          />
        </div>

        {/* Min rating filter */}
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: '0.75rem', color: c.textMuted, flexShrink: 0 }}>Min rating:</span>
          {[0, 1, 2, 3, 4].map(r => (
            <button
              key={r}
              onClick={() => setMinRating(r === minRating ? 0 : r)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
              style={{
                backgroundColor: minRating === r && r > 0 ? c.accentBg : c.surface2,
                color: minRating === r && r > 0 ? c.accentText : c.textSecondary,
                border: `1px solid ${minRating === r && r > 0 ? c.accent : c.border}`,
                cursor: 'pointer',
              }}
            >
              {r === 0 ? 'Any' : <><Star size={10} fill={c.star} stroke="none" /> {r}+</>}
            </button>
          ))}
        </div>

        {/* Tag filters */}
        <div>
          <span style={{ fontSize: '0.75rem', color: c.textMuted, display: 'block', marginBottom: 8 }}>Filter by tag:</span>

          {/* Active tags */}
          {activeTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {activeTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: c.accentBg, color: c.accentText, border: `1px solid ${c.accent}`, cursor: 'pointer' }}
                >
                  {tag} <X size={10} />
                </button>
              ))}
            </div>
          )}

          {/* Tag text input */}
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTagFromInput() } }}
              placeholder="Type a tag and press Enter…"
              style={{
                flex: 1,
                backgroundColor: c.surface2,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                color: c.textPrimary,
                fontSize: '0.82rem',
                padding: '6px 11px',
                outline: 'none',
              }}
            />
            {tagInput.trim() && (
              <button
                onClick={addTagFromInput}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: c.accentBg, color: c.accentText, border: `1px solid ${c.border}`, cursor: 'pointer' }}
              >
                Add
              </button>
            )}
          </div>

          {/* Suggestions */}
          {filteredSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="px-2.5 py-1 rounded-full text-xs"
                  style={{ backgroundColor: c.surface2, color: c.textSecondary, border: `1px solid ${c.border}`, cursor: 'pointer' }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter summary + clear */}
        {hasFilters && (
          <button
            onClick={() => { setQuery(''); setActiveTags([]); setMinRating(0) }}
            className="mt-3 text-xs"
            style={{ color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-16" style={{ color: c.textMuted, fontSize: '0.9rem' }}>Loading…</div>
      ) : books.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: c.surface, border: `1px dashed ${c.border}` }}>
          <p style={{ color: c.textSecondary, fontFamily: '"Lora", serif', fontSize: '1rem', marginBottom: 8 }}>
            {hasFilters ? 'No books match those filters.' : 'No community data yet.'}
          </p>
          <p style={{ color: c.textMuted, fontSize: '0.85rem', marginBottom: 20 }}>
            {hasFilters
              ? 'Try adjusting your search or filters.'
              : 'Rate or tag a book to be the first to contribute.'}
          </p>
          {!hasFilters && (
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText }}
            >
              Find books to rate
            </Link>
          )}
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.8rem', color: c.textMuted, marginBottom: 16 }}>
            {books.length} book{books.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {books.slice(0, visibleCount).map(book => (
              <BookCard key={book.book_id} book={book} />
            ))}
          </div>
          {visibleCount < books.length && (
            <div className="text-center mt-8">
              <button
                onClick={() => setVisibleCount(v => v + 50)}
                className="px-6 py-2.5 rounded-full text-sm font-medium"
                style={{ backgroundColor: c.surface, border: `1.5px solid ${c.border}`, color: c.accentText, cursor: 'pointer' }}
              >
                Show more ({books.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
