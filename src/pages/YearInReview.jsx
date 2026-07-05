import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, Star, Calendar, Zap, ArrowLeft, Trophy } from 'lucide-react'
import { getShelves } from '../lib/shelves'
import { getLog } from '../lib/readingLog'
import { c } from '../lib/theme'

function statCard(label, value, sub) {
  const isLong = String(value).length > 10
  return (
    <div
      className="rounded-2xl p-5 text-center flex flex-col justify-between"
      style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, minHeight: 110 }}
    >
      <div
        style={{
          fontFamily: '"Lora", serif',
          fontSize: isLong ? '1.15rem' : '2.2rem',
          fontWeight: 700,
          color: c.textPrimary,
          lineHeight: 1.2,
          wordBreak: 'break-word',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value}
      </div>
      <div>
        <div style={{ fontSize: '0.68rem', color: c.textMuted, marginTop: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: '0.75rem', color: c.textSecondary, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function YearInReview() {
  const { year: paramYear } = useParams()
  const year = parseInt(paramYear || new Date().getFullYear(), 10)
  const [data, setData] = useState(null)

  useEffect(() => {
    const start = new Date(year, 0, 1).getTime()
    const end   = new Date(year + 1, 0, 1).getTime()

    Promise.all([getShelves(), getLog()]).then(([shelves, log]) => {
      const readBooks = (shelves['read'] || []).filter(b => b.addedAt >= start && b.addedAt < end)

      const totalPages = readBooks.reduce((s, b) => s + (b.pageCount || 0), 0)

      const genreCounts = {}
      for (const b of readBooks) {
        for (const g of (b.categories || [])) genreCounts[g] = (genreCounts[g] || 0) + 1
      }
      const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0] || null

      const authCounts = {}
      for (const b of readBooks) {
        const a = b.authors?.[0]
        if (a) authCounts[a] = (authCounts[a] || 0) + 1
      }
      const topAuthor = Object.entries(authCounts).sort((a, b) => b[1] - a[1])[0] || null

      const withPages = readBooks.filter(b => b.pageCount)
      const longest  = [...withPages].sort((a, b) => b.pageCount - a.pageCount)[0] || null
      const shortest = [...withPages].sort((a, b) => a.pageCount - b.pageCount)[0] || null

      const withRating = readBooks.filter(b => b.averageRating)
      const topRated = [...withRating].sort((a, b) => b.averageRating - a.averageRating)[0] || null

      const loggedPages = Object.values(log).reduce((s, e) => {
        return s + (e.sessions || []).filter(ses => ses.date >= start && ses.date < end)
                             .reduce((ss, ses) => ss + ses.pagesRead, 0)
      }, 0)

      const byMonth = Array.from({ length: 12 }, () => 0)
      for (const b of readBooks) {
        const m = new Date(b.addedAt).getMonth()
        byMonth[m]++
      }

      setData({ readBooks, totalPages, topGenre, topAuthor, longest, shortest, topRated, loggedPages, byMonth })
    })
  }, [year])

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const maxMonth = data ? Math.max(...data.byMonth, 1) : 1

  const prevYear = year - 1
  const nextYear = year + 1
  const thisYear = new Date().getFullYear()

  if (!data) return null

  const hasData = data.readBooks.length > 0

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Home
      </Link>

      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-6 mb-4">
          <Link to={`/year-in-review/${prevYear}`} style={{ color: c.textMuted, fontSize: '0.85rem' }}>← {prevYear}</Link>
          <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 700, color: c.textPrimary, fontSize: '2.5rem' }}>
            {year}
          </h1>
          {year < thisYear && (
            <Link to={`/year-in-review/${nextYear}`} style={{ color: c.textMuted, fontSize: '0.85rem' }}>{nextYear} →</Link>
          )}
        </div>
        <p style={{ color: c.textSecondary }}>Your reading year in review</p>
      </div>

      {!hasData ? (
        <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: c.surface, border: `1px dashed ${c.border}` }}>
          <Calendar size={32} style={{ color: c.textMuted, margin: '0 auto 16px' }} />
          <p style={{ color: c.textSecondary, fontFamily: '"Lora", serif', fontSize: '1rem' }}>No books marked as read in {year}</p>
          <p style={{ color: c.textMuted, fontSize: '0.85rem', marginTop: 8 }}>
            Books you mark as "Read" will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
            {statCard('Books read', data.readBooks.length)}
            {statCard('Pages', data.totalPages > 0 ? data.totalPages.toLocaleString() : '—')}
            {statCard('Top genre', data.topGenre?.[0] ?? '—', data.topGenre ? `${data.topGenre[1]} book${data.topGenre[1] !== 1 ? 's' : ''}` : null)}
            {statCard('Top author', data.topAuthor?.[0] ?? '—', data.topAuthor ? `${data.topAuthor[1]} book${data.topAuthor[1] !== 1 ? 's' : ''}` : null)}
          </div>

          {/* Monthly bar chart */}
          <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
            <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, marginBottom: 20, fontSize: '0.95rem' }}>
              Books read by month
            </h2>
            <div className="flex items-end gap-2" style={{ height: 80 }}>
              {data.byMonth.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: count ? `${(count / maxMonth) * 64}px` : 2,
                      backgroundColor: count ? c.accent : c.surface2,
                      minHeight: 2,
                    }}
                  />
                  <span style={{ fontSize: '0.6rem', color: c.textMuted }}>{MONTHS[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-3">
            {data.longest && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={13} style={{ color: c.accentText }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted }}>Longest read</span>
                </div>
                <Link to={`/book/${data.longest.id}`}>
                  <p style={{ fontFamily: '"Lora", serif', color: c.textPrimary, fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.35 }}>{data.longest.title}</p>
                  <p style={{ color: c.textMuted, fontSize: '0.75rem', marginTop: 4 }}>{data.longest.pageCount?.toLocaleString()} pages</p>
                </Link>
              </div>
            )}
            {data.shortest && data.shortest.id !== data.longest?.id && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={13} style={{ color: c.accentText }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted }}>Quickest read</span>
                </div>
                <Link to={`/book/${data.shortest.id}`}>
                  <p style={{ fontFamily: '"Lora", serif', color: c.textPrimary, fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.35 }}>{data.shortest.title}</p>
                  <p style={{ color: c.textMuted, fontSize: '0.75rem', marginTop: 4 }}>{data.shortest.pageCount?.toLocaleString()} pages</p>
                </Link>
              </div>
            )}
            {data.topRated && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={13} style={{ color: c.accentText }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.textMuted }}>Highest rated</span>
                </div>
                <Link to={`/book/${data.topRated.id}`}>
                  <p style={{ fontFamily: '"Lora", serif', color: c.textPrimary, fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.35 }}>{data.topRated.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={10} fill={c.star} stroke="none" />
                    <span style={{ fontSize: '0.75rem', color: c.warm }}>{data.topRated.averageRating?.toFixed(1)}</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* All books read that year */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
            <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, marginBottom: 16, fontSize: '0.95rem' }}>
              All {data.readBooks.length} books
            </h2>
            <div className="flex flex-wrap gap-3">
              {data.readBooks.map(book => (
                <Link key={book.id} to={`/book/${book.id}`} className="group" title={book.title}>
                  <div
                    className="rounded overflow-hidden transition-transform group-hover:scale-105"
                    style={{ width: 52, height: 78, backgroundColor: c.surface2, boxShadow: '1px 2px 8px rgba(0,0,0,0.4)' }}
                  >
                    {book.cover && <img src={book.cover} alt={book.title} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
