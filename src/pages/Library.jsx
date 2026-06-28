import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Clock, CheckCheck } from 'lucide-react'
import { getShelves } from '../lib/shelves'
import { c } from '../lib/theme'

const SHELF_META = {
  'currently-reading': { label: 'Currently Reading', icon: BookOpen, color: '#2f5d8a' },
  'want-to-read':      { label: 'Want to Read',      icon: Clock,     color: '#2a4d6e' },
  'read':              { label: 'Read',               icon: CheckCheck,color: '#1e3d55' },
}

const BOOKS_PER_ROW = 10

function BookSpine({ book }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      to={`/book/${book.id}`}
      className="relative flex-shrink-0 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: 72, transition: 'transform 0.15s ease', transform: hovered ? 'translateY(-8px)' : 'translateY(0)' }}
    >
      {/* Book cover */}
      <div
        className="rounded-sm overflow-hidden"
        style={{
          width: 72,
          height: 108,
          backgroundColor: c.surface2,
          boxShadow: hovered
            ? '2px 8px 20px rgba(0,0,0,0.6), -1px 0 0 rgba(0,0,0,0.3)'
            : '1px 3px 8px rgba(0,0,0,0.5), -1px 0 0 rgba(0,0,0,0.2)',
        }}
      >
        {book.cover ? (
          <img src={book.cover} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div
            className="w-full h-full flex items-end p-1.5"
            style={{ background: `linear-gradient(160deg, ${c.surface2}, ${c.surface})` }}
          >
            <span className="text-xs leading-tight line-clamp-3" style={{ color: c.accentText, fontFamily: '"Lora", serif', fontSize: '0.6rem' }}>
              {book.title}
            </span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute bottom-full left-1/2 mb-2 z-20 pointer-events-none"
          style={{ transform: 'translateX(-50%)', width: 140 }}
        >
          <div
            className="rounded-lg px-3 py-2 text-center"
            style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
          >
            <p className="text-xs font-medium leading-tight" style={{ color: c.textPrimary, fontFamily: '"Lora", serif' }}>
              {book.title}
            </p>
            {book.authors?.[0] && (
              <p className="text-xs mt-0.5" style={{ color: c.textSecondary }}>{book.authors[0]}</p>
            )}
          </div>
          {/* arrow */}
          <div className="flex justify-center">
            <div style={{ width: 8, height: 6, background: c.surface, clipPath: 'polygon(0 0, 100% 0, 50% 100%)', borderBottom: `1px solid ${c.border}` }} />
          </div>
        </div>
      )}
    </Link>
  )
}

function ShelfRow({ books, shelfColor }) {
  return (
    <div className="relative">
      {/* Books sitting on the plank */}
      <div className="flex items-end gap-1.5 px-4 pt-4">
        {books.map(book => (
          <BookSpine key={book.id} book={book} />
        ))}
      </div>
      {/* Shelf plank */}
      <div
        className="w-full"
        style={{
          height: 14,
          background: `linear-gradient(180deg, ${shelfColor} 0%, color-mix(in srgb, ${shelfColor} 60%, black) 100%)`,
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          borderRadius: '0 0 3px 3px',
        }}
      />
    </div>
  )
}

function LibrarySection({ shelfId, books }) {
  const { label, icon: Icon, color } = SHELF_META[shelfId]

  if (!books.length) return null

  // split books into rows of BOOKS_PER_ROW
  const rows = []
  for (let i = 0; i < books.length; i += BOOKS_PER_ROW) {
    rows.push(books.slice(i, i + BOOKS_PER_ROW))
  }

  return (
    <section className="mb-14">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={15} style={{ color: c.accentText }} />
        <h2 style={{ fontFamily: '"Lora", serif', fontSize: '1.1rem', fontWeight: 600, color: c.textPrimary }}>
          {label}
        </h2>
        <span
          className="ml-1 px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: c.accentBg, color: c.textSecondary }}
        >
          {books.length}
        </span>
        <Link
          to={`/shelf/${shelfId}`}
          className="ml-auto text-xs"
          style={{ color: c.textMuted }}
        >
          Manage →
        </Link>
      </div>

      {/* Bookcase */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#0a0f1a', border: `1px solid ${c.border}`, padding: '8px 0 0' }}
      >
        {rows.map((row, i) => (
          <ShelfRow key={i} books={row} shelfColor={color} />
        ))}
      </div>
    </section>
  )
}

export default function Library() {
  const [shelves, setShelves] = useState({})

  useEffect(() => {
    setShelves(getShelves())
  }, [])

  const total = Object.values(shelves).flat().length
  const hasBooks = total > 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '2rem', marginBottom: '0.3rem' }}>
            My Library
          </h1>
          <p style={{ color: c.textSecondary, fontSize: '0.95rem' }}>
            {hasBooks ? `${total} book${total !== 1 ? 's' : ''} across your shelves` : 'Your library is empty — start adding books.'}
          </p>
        </div>
        {hasBooks && (
          <Link
            to="/library/graph"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0"
            style={{ backgroundColor: c.surface, color: c.accentText, border: `1px solid ${c.border}` }}
          >
            View Connections
          </Link>
        )}
      </div>

      {hasBooks ? (
        Object.keys(SHELF_META).map(id => (
          <LibrarySection key={id} shelfId={id} books={shelves[id] || []} />
        ))
      ) : (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ backgroundColor: c.surface, border: `1px dashed ${c.border}` }}
        >
          <BookOpen size={36} style={{ color: c.textMuted, margin: '0 auto 16px' }} />
          <p style={{ color: c.textSecondary, fontSize: '1rem', fontFamily: '"Lora", serif', marginBottom: 8 }}>
            No books yet
          </p>
          <p style={{ color: c.textMuted, fontSize: '0.85rem', marginBottom: 24 }}>
            Search for books and add them to a shelf to build your library.
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
    </div>
  )
}
