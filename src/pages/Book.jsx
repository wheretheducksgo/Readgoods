import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Star, BookOpen, Calendar, Building, Hash, ChevronRight,
  Network, Loader2, AlertCircle, NotebookPen
} from 'lucide-react'
import BookCard from '../components/BookCard'
import ShelfButton from '../components/ShelfButton'
import { getVolume, getRelatedBooks } from '../lib/localBooks'
import { getBookReviews } from '../lib/aiReview'
import { getBookShelf } from '../lib/shelves'
import { finishReading } from '../lib/readingLog'
import { getBookRating, setBookRating, getBookReview, setBookReview } from '../lib/ratings'
import MoodTagger from '../components/MoodTagger'
import PaceTracker from '../components/PaceTracker'
import { c } from '../lib/theme'

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < Math.round(rating) ? c.star : 'none'}
          stroke={i < Math.round(rating) ? c.star : c.textMuted}
        />
      ))}
      <span className="text-sm ml-1" style={{ color: c.warm }}>{rating.toFixed(1)}</span>
    </div>
  )
}

function RatingBar({ star, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: c.textMuted, width: 8, textAlign: 'right', flexShrink: 0 }}>{star}</span>
      <Star size={9} fill={c.star} stroke="none" style={{ flexShrink: 0 }} />
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, backgroundColor: c.surface2 }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: c.star, borderRadius: 9999 }} />
      </div>
      <span style={{ color: c.textMuted, width: 28, textAlign: 'right', flexShrink: 0 }}>{count}</span>
    </div>
  )
}

function CustomerReviewPanel({ book }) {
  const [state, setState] = useState('loading')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    getBookReviews(book).then(result => {
      if (cancelled) return
      setData(result)
      setState('done')
    })
    return () => { cancelled = true }
  }, [book.id])

  return (
    <div
      className="rounded-xl overflow-hidden mt-6"
      style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: `1px solid ${c.border}` }}
      >
        <div className="flex items-center gap-2">
          <Star size={15} fill={c.star} stroke="none" />
          <span style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem' }}>
            Global Ratings
          </span>
        </div>
        {state === 'done' && data?.found && (
          <span style={{ fontSize: '0.72rem', color: c.textMuted }}>Community</span>
        )}
      </div>

      <div className="px-5 py-4">
        {state === 'loading' && (
          <div className="flex items-center gap-2 py-2" style={{ color: c.textSecondary }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading ratings…</span>
          </div>
        )}

        {state === 'done' && !data?.found && (
          <div className="flex items-start gap-2" style={{ color: c.textMuted }}>
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm">{data?.warning || 'No community data found for this book.'}</p>
          </div>
        )}

        {state === 'done' && data?.found && (
          <div className="space-y-5">
            {/* Aggregate rating + breakdown */}
            <div className="flex gap-6 items-start">
              {data.avgRating && (
                <div className="text-center flex-shrink-0">
                  <div style={{ fontFamily: '"Lora", serif', fontSize: '2.5rem', fontWeight: 700, color: c.textPrimary, lineHeight: 1 }}>
                    {data.avgRating.toFixed(1)}
                  </div>
                  <div className="flex justify-center gap-0.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={11} fill={i < Math.round(data.avgRating) ? c.star : 'none'} stroke={i < Math.round(data.avgRating) ? c.star : c.textMuted} />
                    ))}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: c.textMuted, marginTop: 4 }}>
                    {data.ratingCount?.toLocaleString()} ratings
                  </div>
                </div>
              )}

              {data.ratingBreakdown && (
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(star => (
                    <RatingBar
                      key={star}
                      star={star}
                      count={data.ratingBreakdown[star] || 0}
                      total={data.ratingCount || 1}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Reading stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Want to read', value: data.wantToRead },
                { label: 'Reading now', value: data.currentlyReading },
                { label: 'Have read', value: data.alreadyRead },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: c.surface2 }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: c.textPrimary, fontFamily: '"Lora", serif' }}>
                    {value?.toLocaleString() ?? '—'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: c.textMuted, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* AI reader sentiment summary */}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Book() {
  const { id } = useParams()
  const [book, setBook] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [onShelf, setOnShelf] = useState(false)
  const [currentShelf, setCurrentShelf] = useState(null)
  const [myRating, setMyRating] = useState(null)
  const [myReview, setMyReview] = useState('')
  const [reviewSaved, setReviewSaved] = useState(false)
  const reviewRef = useRef('')
  const reviewSavedRef = useRef(false)
  const bookIdRef = useRef(id)

  async function refreshShelfState() {
    const shelf = await getBookShelf(id)
    setOnShelf(!!shelf)
    setCurrentShelf(shelf)
    if (shelf) {
      const [rating, review] = await Promise.all([getBookRating(id), getBookReview(id)])
      setMyRating(rating)
      setMyReview(review)
    } else {
      setMyRating(null)
      setMyReview('')
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setBook(null)
    setRelated([])
    setExpanded(false)
    setMyRating(null)
    setMyReview('')
    setReviewSaved(false)
    getBookShelf(id).then(shelf => {
      if (!active) return
      setOnShelf(!!shelf)
      setCurrentShelf(shelf)
      if (shelf) {
        Promise.all([getBookRating(id), getBookReview(id)]).then(([rating, review]) => {
          if (!active) return
          setMyRating(rating)
          setMyReview(review)
          // Only seed ref from DB if the user hasn't typed anything yet
          if (!reviewRef.current) reviewRef.current = review || ''
        })
      }
    })
    try {
      const b = getVolume(id)
      if (!active) return
      setBook(b)
      setLoading(false)
      const rel = getRelatedBooks(b)
      if (active) setRelated(rel.slice(0, 8))
    } catch (e) {
      if (active) { setError(e.message); setLoading(false) }
    }
    return () => { active = false }
  }, [id])

  // Save unsaved review on unmount (e.g. user navigates away mid-typing)
  useEffect(() => {
    bookIdRef.current = id
    reviewRef.current = ''
    reviewSavedRef.current = false
    return () => {
      if (!reviewSavedRef.current && reviewRef.current) {
        setBookReview(bookIdRef.current, reviewRef.current)
      }
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32" style={{ color: c.textSecondary }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p style={{ color: c.textSecondary }}>Couldn't load this book. <Link to="/search" style={{ color: c.accentText }}>Search again?</Link></p>
      </div>
    )
  }

  const desc = book.description || ''
  const descWords = desc.split(' ')
  const isLong = descWords.length > 80
  const displayDesc = (isLong && !expanded)
    ? descWords.slice(0, 80).join(' ') + '…'
    : desc

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Book header */}
      <div className="flex gap-8 mb-10">
        {/* Cover */}
        <div
          className="rounded-xl overflow-hidden shadow-lg flex-shrink-0"
          style={{ width: 168, height: 252, backgroundColor: c.surface2 }}
        >
          {book.cover ? (
            <img
              src={book.coverLarge || book.cover}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-end p-4"
              style={{
                background: book.coverHue != null
                  ? `linear-gradient(150deg, hsl(${book.coverHue},35%,22%) 0%, hsl(${book.coverHue},50%,14%) 100%)`
                  : `linear-gradient(135deg, ${c.surface2} 0%, ${c.surface} 100%)`,
              }}
            >
              <span style={{ fontFamily: '"Lora", serif', color: `hsl(${book.coverHue ?? 220},60%,75%)`, fontWeight: 500, fontSize: '0.9rem' }}>
                {book.title}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1
            style={{
              fontFamily: '"Lora", serif',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: c.textPrimary,
              lineHeight: 1.2,
              marginBottom: 6,
            }}
          >
            {book.title}
          </h1>
          {book.authors.length > 0 && (
            <p className="text-base mb-3" style={{ color: c.textSecondary }}>
              by {book.authors.join(', ')}
            </p>
          )}

          {book.averageRating && (
            <div className="mb-4">
              <StarRating rating={book.averageRating} />
              {book.ratingsCount > 0 && (
                <p className="text-xs mt-1" style={{ color: c.textMuted }}>
                  {book.ratingsCount.toLocaleString()} ratings
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            {book.categories?.slice(0, 3).map(cat => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full text-xs"
                style={{ backgroundColor: c.accentBg, color: c.accentText }}
              >
                {cat}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mb-5 text-xs" style={{ color: c.textSecondary }}>
            {book.publishedDate && (
              <span className="flex items-center gap-1">
                <Calendar size={12} /> {book.publishedDate.slice(0, 4)}
              </span>
            )}
            {book.publisher && (
              <span className="flex items-center gap-1">
                <Building size={12} /> {book.publisher}
              </span>
            )}
            {book.pageCount && (
              <span className="flex items-center gap-1">
                <BookOpen size={12} /> {book.pageCount} pages
              </span>
            )}
            {book.isbn && (
              <span className="flex items-center gap-1">
                <Hash size={12} /> {book.isbn}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <ShelfButton book={book} onUpdate={refreshShelfState} />
            <Link
              to={`/connections/${book.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: c.surface2, color: c.accentText, border: `1px solid ${c.border}` }}
            >
              <Network size={14} />
              Book Connections
            </Link>
            {onShelf && (
              <Link
                to={`/notes/${book.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: c.surface2, color: c.accentText, border: `1px solid ${c.border}` }}
              >
                <NotebookPen size={14} />
                My Notes
              </Link>
            )}
            {book.previewLink && (
              <a
                href={book.previewLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: c.textSecondary, border: `1px solid ${c.border}` }}
              >
                Preview <ChevronRight size={13} />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left col: description + AI review */}
        <div className="md:col-span-2">
          {book.description && (
            <section className="mb-6">
              <h2 style={{ fontFamily: '"Lora", serif', fontSize: '1.1rem', fontWeight: 600, color: c.textPrimary, marginBottom: 10 }}>
                About this book
              </h2>
              <div
                className="text-sm leading-relaxed"
                style={{ color: c.textSecondary }}
                dangerouslySetInnerHTML={{ __html: displayDesc }}
              />
              {isLong && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-xs mt-2 font-medium"
                  style={{ color: c.accentText, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </section>
          )}

          {onShelf && (
            <div
              className="rounded-xl p-5 mb-6"
              style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}
            >
              {/* Personal rating */}
              <div className="mb-5">
                <p style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted, marginBottom: 8 }}>
                  My Rating
                </p>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={async () => {
                        const next = myRating === star ? null : star
                        setMyRating(next)
                        await setBookRating(book.id, next)
                        if (!next) { setMyReview(''); reviewRef.current = ''; reviewSavedRef.current = true; await setBookReview(book.id, '') }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    >
                      <Star
                        size={22}
                        fill={myRating >= star ? c.star : 'none'}
                        stroke={myRating >= star ? c.star : c.textMuted}
                      />
                    </button>
                  ))}
                  {myRating && (
                    <span className="ml-2 text-sm" style={{ color: c.warm }}>{myRating}.0</span>
                  )}
                </div>
                {myRating && (
                  <div>
                    <textarea
                      placeholder="Write a review… (optional)"
                      value={myReview}
                      rows={3}
                      onChange={e => { setMyReview(e.target.value); reviewRef.current = e.target.value; reviewSavedRef.current = false; setReviewSaved(false) }}
                      onBlur={async () => {
                        await setBookReview(bookIdRef.current, reviewRef.current)
                        reviewSavedRef.current = true
                        setReviewSaved(true)
                        setTimeout(() => setReviewSaved(false), 2000)
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: c.surface2,
                        border: `1px solid ${c.border}`,
                        borderRadius: 8,
                        color: c.textPrimary,
                        fontSize: '0.85rem',
                        padding: '8px 12px',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: 1.6,
                      }}
                    />
                    {reviewSaved && (
                      <p style={{ fontSize: '0.72rem', color: '#5cb87a', marginTop: 4 }}>Review saved</p>
                    )}
                  </div>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${c.border}`, marginBottom: 16 }} />
              <MoodTagger bookId={book.id} />
              {currentShelf === 'currently-reading' && (
                <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                  <PaceTracker bookId={book.id} totalPages={book.pageCount} />
                </div>
              )}
            </div>
          )}

          <CustomerReviewPanel book={book} />
        </div>

        {/* Right col: related */}
        {related.length > 0 && (
          <div>
            <h2 style={{ fontFamily: '"Lora", serif', fontSize: '1.1rem', fontWeight: 600, color: c.textPrimary, marginBottom: 14 }}>
              You might also like
            </h2>
            <div className="flex flex-col gap-4">
              {related.slice(0, 5).map(b => (
                <Link key={b.id} to={`/book/${b.id}`} className="flex items-start gap-3 group">
                  <div
                    className="rounded overflow-hidden flex-shrink-0"
                    style={{ width: 44, height: 66, backgroundColor: c.surface2 }}
                  >
                    {b.cover
                    ? <img src={b.cover} alt={b.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-end p-1" style={{ background: b.coverHue != null ? `linear-gradient(150deg, hsl(${b.coverHue},35%,22%) 0%, hsl(${b.coverHue},50%,14%) 100%)` : `linear-gradient(135deg, ${c.surface2}, ${c.surface})` }}><span style={{ fontSize: '0.45rem', color: `hsl(${b.coverHue ?? 220},60%,75%)`, fontFamily: '"Lora", serif', lineHeight: 1.2 }}>{b.title}</span></div>
                  }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug" style={{ color: c.textPrimary, fontFamily: '"Lora", serif' }}>
                      {b.title}
                    </p>
                    {b.authors?.[0] && (
                      <p className="text-xs mt-0.5" style={{ color: c.textSecondary }}>{b.authors[0]}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
