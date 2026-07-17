import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Save, Trash2, Quote, Plus, X } from 'lucide-react'
import { getVolume } from '../lib/localBooks'
import { getBookShelf } from '../lib/shelves'
import { getBookHighlights, addHighlight, removeHighlight } from '../lib/highlights'
import { getNote, saveNote } from '../lib/notes'
import { c } from '../lib/theme'

function HighlightsPanel({ bookId }) {
  const [highlights, setHighlights] = useState([])
  const [quoteText, setQuoteText] = useState('')
  const [page, setPage] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    getBookHighlights(bookId).then(setHighlights)
  }, [bookId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!quoteText.trim()) return
    const updated = await addHighlight(bookId, quoteText, page || null)
    setHighlights(updated)
    setQuoteText('')
    setPage('')
    setAdding(false)
  }

  async function handleRemove(id) {
    await removeHighlight(bookId, id)
    getBookHighlights(bookId).then(setHighlights)
  }

  return (
    <div className="rounded-xl overflow-hidden mt-6" style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${c.border}` }}>
        <div className="flex items-center gap-2">
          <Quote size={14} style={{ color: c.accentText }} />
          <span style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.9rem' }}>
            Highlights & Quotes
          </span>
          {highlights.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: c.accentBg, color: c.textSecondary }}>
              {highlights.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: c.surface2, color: c.accentText, border: `1px solid ${c.border}`, cursor: 'pointer' }}
        >
          <Plus size={11} /> Add quote
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="p-5" style={{ borderBottom: highlights.length ? `1px solid ${c.border}` : 'none' }}>
          <textarea
            value={quoteText}
            onChange={e => setQuoteText(e.target.value)}
            placeholder="Paste or type a quote…"
            autoFocus
            className="w-full resize-none outline-none text-sm leading-relaxed rounded-lg p-3 mb-2"
            rows={3}
            style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={page}
              onChange={e => setPage(e.target.value)}
              placeholder="Page (optional)"
              className="rounded-lg px-3 py-1.5 text-sm outline-none w-32"
              style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: 'pointer' }}>
              Save
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs" style={{ color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {highlights.length === 0 && !adding ? (
        <p className="px-5 py-6 text-sm text-center" style={{ color: c.textMuted }}>
          No highlights yet — save a favourite quote from this book.
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: c.borderSoft }}>
          {highlights.map(h => (
            <div key={h.id} className="px-5 py-4 flex gap-3 group">
              <Quote size={14} style={{ color: c.textMuted, flexShrink: 0, marginTop: 3 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed" style={{ color: c.textPrimary, fontFamily: '"Lora", serif', fontStyle: 'italic' }}>
                  "{h.text}"
                </p>
                {h.page && (
                  <p className="text-xs mt-1" style={{ color: c.textMuted }}>p. {h.page}</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(h.id)}
                className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, transition: 'opacity 0.15s' }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BookNotes() {
  const { id } = useParams()
  const idRef = useRef(id)
  const mountedRef = useRef(true)
  const [book, setBook] = useState(null)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const [shelf, setShelf] = useState(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    idRef.current = id
    try { setBook(getVolume(id)) } catch {}
    getBookShelf(id).then(setShelf)
    getNote(id).then(t => { if (t) setText(t) })
    return () => clearTimeout(saveTimer.current)
  }, [id])

  function handleChange(e) {
    setText(e.target.value)
    setSaved(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveNote(idRef.current, e.target.value)
        if (mountedRef.current) setSaved(true)
      } catch {
        if (mountedRef.current) setSaved(false)
      }
    }, 800)
  }

  function handleClear() {
    setText('')
    saveNote(idRef.current, '')
    setSaved(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to={`/book/${id}`} className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Back to book
      </Link>

      {book && (
        <div className="flex gap-5 mb-8">
          <div className="rounded-lg overflow-hidden flex-shrink-0 shadow-md" style={{ width: 64, height: 96, backgroundColor: c.surface2 }}>
            {book.cover ? (
              <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-end p-2" style={{
                background: book.coverHue != null
                  ? `linear-gradient(150deg, hsl(${book.coverHue},35%,22%) 0%, hsl(${book.coverHue},50%,14%) 100%)`
                  : `linear-gradient(135deg, ${c.surface2}, ${c.surface})`,
              }}>
                <span style={{ fontSize: '0.55rem', color: `hsl(${book.coverHue ?? 220},60%,75%)`, fontFamily: '"Lora", serif', lineHeight: 1.3 }}>
                  {book.title}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 style={{ fontFamily: '"Lora", serif', fontSize: '1.4rem', fontWeight: 700, color: c.textPrimary, lineHeight: 1.25, marginBottom: 4 }}>
              {book.title}
            </h1>
            {book.authors?.[0] && (
              <p style={{ color: c.textSecondary, fontSize: '0.9rem' }}>by {book.authors.join(', ')}</p>
            )}
            {shelf && (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: c.accentBg, color: c.accentText }}>
                {shelf === 'currently-reading' ? 'Currently Reading' : shelf === 'want-to-read' ? 'Want to Read' : 'Read'}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-2">
            <BookOpen size={14} style={{ color: c.accentText }} />
            <span style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.9rem' }}>My Notes</span>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-xs" style={{ color: c.textMuted }}>
                <Save size={11} /> Saved
              </span>
            )}
            {text && (
              <button onClick={handleClear} className="flex items-center gap-1 text-xs" style={{ color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>
        </div>
        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Write your thoughts, quotes, or reflections…"
          className="w-full resize-none outline-none p-5 text-sm leading-relaxed"
          style={{ backgroundColor: c.surface, color: c.textPrimary, minHeight: '320px', fontFamily: 'inherit' }}
        />
      </div>

      <HighlightsPanel bookId={id} />

      <p className="mt-4 text-xs" style={{ color: c.textMuted }}>
        Notes and highlights are saved automatically and stored locally on this device.
      </p>
    </div>
  )
}
