import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { c } from '../lib/theme'

export default function BookCard({ book, size = 'md' }) {
  const isSmall = size === 'sm'
  const w = isSmall ? 80 : 108
  const h = isSmall ? 120 : 162

  return (
    <Link to={`/book/${book.id}`} className="group flex flex-col items-start">
      <div
        className="rounded-lg overflow-hidden flex-shrink-0 transition-all"
        style={{
          width: w, height: h,
          backgroundColor: c.surface2,
          boxShadow: `0 2px 8px rgba(0,0,0,0.4)`,
        }}
      >
        {book.cover ? (
          <img
            src={book.cover}
            alt={book.title}
            width={w}
            height={h}
            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-end p-2" style={{ background: `linear-gradient(135deg, ${c.surface2} 0%, ${c.surface} 100%)` }}>
            <span className="text-xs leading-tight" style={{ color: c.accentText, fontFamily: '"Lora", serif', fontWeight: 500 }}>
              {book.title}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 w-full" style={{ maxWidth: w }}>
        <p className="text-xs font-medium leading-snug line-clamp-2" style={{ color: c.textPrimary, fontFamily: '"Lora", serif' }}>
          {book.title}
        </p>
        {book.authors?.[0] && (
          <p className="text-xs mt-0.5 truncate" style={{ color: c.textSecondary }}>
            {book.authors[0]}
          </p>
        )}
        {book.averageRating && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <Star size={10} fill={c.star} stroke="none" />
            <span className="text-xs" style={{ color: c.warm }}>
              {book.averageRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
