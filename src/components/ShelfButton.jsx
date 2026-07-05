import { useState, useEffect } from 'react'
import { Check, ChevronDown, BookOpen, Clock, CheckCheck, X } from 'lucide-react'
import { addToShelf, removeFromShelves, getBookShelf } from '../lib/shelves'
import { startReading, finishReading } from '../lib/readingLog'
import { c } from '../lib/theme'

const SHELVES = [
  { id: 'want-to-read', label: 'Want to Read', icon: Clock },
  { id: 'currently-reading', label: 'Currently Reading', icon: BookOpen },
  { id: 'read', label: 'Read', icon: CheckCheck },
]

export default function ShelfButton({ book, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [currentShelf, setCurrentShelf] = useState(null)

  useEffect(() => {
    getBookShelf(book.id).then(setCurrentShelf)
  }, [book.id])

  async function handleSelect(shelfId) {
    if (currentShelf === shelfId) {
      await removeFromShelves(book.id)
      setCurrentShelf(null)
    } else {
      await addToShelf(shelfId, book)
      setCurrentShelf(shelfId)
      if (shelfId === 'currently-reading') await startReading(book.id, book.pageCount)
      if (shelfId === 'read') await finishReading(book.id)
    }
    setOpen(false)
    onUpdate?.()
  }

  const active = SHELVES.find(s => s.id === currentShelf)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          backgroundColor: active ? c.btnPrimary : c.surface2,
          color: active ? c.btnPrimaryText : c.textPrimary,
          border: `1px solid ${active ? c.accent : c.border}`,
          cursor: 'pointer',
        }}
      >
        {active ? <Check size={14} /> : <BookOpen size={14} />}
        {active ? active.label : 'Add to Shelf'}
        <ChevronDown size={13} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden py-1"
            style={{
              backgroundColor: c.surface,
              border: `1px solid ${c.border}`,
              minWidth: 210,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {SHELVES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left"
                style={{
                  color: currentShelf === id ? c.accentText : c.textSecondary,
                  backgroundColor: currentShelf === id ? c.accentBg : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: currentShelf === id ? 500 : 400,
                }}
              >
                <Icon size={14} />
                {label}
                {currentShelf === id && <Check size={13} className="ml-auto" style={{ color: c.accent }} />}
              </button>
            ))}
            {currentShelf && (
              <>
                <div style={{ borderTop: `1px solid ${c.border}`, margin: '4px 0' }} />
                <button
                  onClick={() => handleSelect(currentShelf)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left"
                  style={{ color: c.textMuted, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                >
                  <X size={14} />
                  Remove from shelf
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
