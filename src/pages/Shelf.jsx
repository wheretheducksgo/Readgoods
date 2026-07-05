import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BookOpen, Clock, CheckCheck, ArrowLeft, ArrowUpDown } from 'lucide-react'
import BookCard from '../components/BookCard'
import { getShelves } from '../lib/shelves'
import { c } from '../lib/theme'

const SHELF_META = {
  'currently-reading': { label: 'Currently Reading', icon: BookOpen },
  'want-to-read': { label: 'Want to Read', icon: Clock },
  'read': { label: 'Read', icon: CheckCheck },
}

const SORT_OPTIONS = [
  { value: 'added', label: 'Date added' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'rating', label: 'Rating' },
]

function sortBooks(books, sort) {
  const sorted = [...books]
  if (sort === 'title') return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  if (sort === 'author') return sorted.sort((a, b) => (a.authors?.[0] || '').localeCompare(b.authors?.[0] || ''))
  if (sort === 'rating') return sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
  return sorted // 'added' — keep original order
}

export default function Shelf() {
  const { id } = useParams()
  const [books, setBooks] = useState([])
  const [sort, setSort] = useState('added')
  const meta = SHELF_META[id] || { label: id, icon: BookOpen }
  const Icon = meta.icon

  useEffect(() => {
    getShelves().then(shelves => setBooks(shelves[id] || []))
  }, [id])

  const sorted = sortBooks(books, sort)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Home
      </Link>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Icon size={20} style={{ color: c.accentText }} />
          <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: '1.75rem', color: c.textPrimary }}>
            {meta.label}
          </h1>
          <span className="text-sm px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: c.accentBg, color: c.accentText }}>
            {books.length}
          </span>
        </div>
        {books.length > 1 && (
          <div className="flex items-center gap-2">
            <ArrowUpDown size={13} style={{ color: c.textMuted }} />
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5 outline-none"
              style={{ backgroundColor: c.surface, color: c.textPrimary, border: `1px solid ${c.border}`, cursor: 'pointer' }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {books.length === 0 ? (
        <div className="text-center py-20" style={{ color: c.textMuted }}>
          <Icon size={36} style={{ margin: '0 auto 12px', color: c.textMuted }} />
          <p style={{ fontFamily: '"Lora", serif', fontSize: '1.1rem', color: c.textSecondary }}>
            Nothing here yet.
          </p>
          <Link to="/search" className="text-sm mt-3 inline-block" style={{ color: c.accentText }}>
            Find books to add →
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-5">
          {sorted.map(book => <BookCard key={book.id} book={book} />)}
        </div>
      )}
    </div>
  )
}
