import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Users, BookOpen, ArrowLeft, Copy, Check } from 'lucide-react'
import { c } from '../lib/theme'

const API = ''

// ── Create club form ──────────────────────────────────────────────────────────

function CreateClub() {
  const navigate = useNavigate()
  const [bookTitle, setBookTitle] = useState('')
  const [bookCover, setBookCover] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!bookTitle.trim() || !creatorName.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/club`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: Date.now().toString(), bookTitle: bookTitle.trim(), bookCover: bookCover.trim() || null, creatorName: creatorName.trim() }),
      })
      const data = await res.json()
      if (data.clubId) navigate(`/club/${data.clubId}?name=${encodeURIComponent(creatorName.trim())}`)
      else setError('Could not create club.')
    } catch {
      setError('Server not available.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Home
      </Link>
      <h1 style={{ fontFamily: '"Lora", serif', fontSize: '1.6rem', fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>
        Start a Book Club
      </h1>
      <p style={{ color: c.textSecondary, fontSize: '0.9rem', marginBottom: 28 }}>
        Share the link with friends — everyone tracks their progress together.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label style={{ fontSize: '0.8rem', color: c.textSecondary, display: 'block', marginBottom: 6 }}>Book title *</label>
          <input
            type="text"
            value={bookTitle}
            onChange={e => setBookTitle(e.target.value)}
            placeholder="e.g. The Name of the Wind"
            required
            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ backgroundColor: c.surface, color: c.textPrimary, border: `1px solid ${c.border}` }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: c.textSecondary, display: 'block', marginBottom: 6 }}>Cover image URL (optional)</label>
          <input
            type="url"
            value={bookCover}
            onChange={e => setBookCover(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ backgroundColor: c.surface, color: c.textPrimary, border: `1px solid ${c.border}` }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: c.textSecondary, display: 'block', marginBottom: 6 }}>Your name *</label>
          <input
            type="text"
            value={creatorName}
            onChange={e => setCreatorName(e.target.value)}
            placeholder="e.g. Alex"
            required
            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ backgroundColor: c.surface, color: c.textPrimary, border: `1px solid ${c.border}` }}
          />
        </div>
        {error && <p style={{ color: '#e55', fontSize: '0.83rem' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg py-2.5 text-sm font-medium"
          style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Creating…' : 'Create Club'}
        </button>
      </form>

      <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${c.border}` }}>
        <p style={{ color: c.textSecondary, fontSize: '0.85rem', marginBottom: 10 }}>Already have a club code?</p>
        <JoinByCode />
      </div>
    </div>
  )
}

function JoinByCode() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  function join(e) {
    e.preventDefault()
    const id = code.trim().toUpperCase()
    if (id && name.trim()) navigate(`/club/${id}?name=${encodeURIComponent(name.trim())}`)
  }

  return (
    <form onSubmit={join} className="flex gap-2">
      <input
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Club code"
        maxLength={6}
        className="rounded-lg px-3 py-2 text-sm outline-none w-28 uppercase"
        style={{ backgroundColor: c.surface, color: c.textPrimary, border: `1px solid ${c.border}`, letterSpacing: '0.1em' }}
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        className="rounded-lg px-3 py-2 text-sm outline-none flex-1"
        style={{ backgroundColor: c.surface, color: c.textPrimary, border: `1px solid ${c.border}` }}
      />
      <button
        type="submit"
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}`, cursor: 'pointer' }}
      >
        Join
      </button>
    </form>
  )
}

// ── Club view ─────────────────────────────────────────────────────────────────

function ClubView({ clubId, memberName }) {
  const [club, setClub] = useState(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    try {
      const res = await fetch(`${API}/api/club/${clubId}`)
      if (!res.ok) { setError('Club not found.'); return }
      const data = await res.json()
      setClub(data)
      const me = data.members.find(m => m.name.toLowerCase() === memberName.toLowerCase())
      if (me) { setProgress(me.progress || ''); setNote(me.note || '') }
    } catch { setError('Could not reach server.') }
  }

  useEffect(() => { load() }, [clubId])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/club/${clubId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName, progress, note }),
      })
      const data = await res.json()
      setClub(data)
    } catch {}
    setSaving(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  if (error) return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <p style={{ color: '#e55' }}>{error}</p>
      <Link to="/club/new" className="text-sm mt-4 inline-block" style={{ color: c.accentText }}>← Create a club</Link>
    </div>
  )

  if (!club) return (
    <div className="max-w-xl mx-auto px-6 py-10 flex items-center gap-3" style={{ color: c.textMuted }}>
      <div className="animate-spin w-4 h-4 rounded-full border-2" style={{ borderColor: c.accent, borderTopColor: 'transparent' }} />
      Loading club…
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Home
      </Link>

      {/* Header */}
      <div className="flex gap-5 mb-8 items-start">
        {club.bookCover && (
          <div className="rounded-lg overflow-hidden flex-shrink-0 shadow-md" style={{ width: 64, height: 96 }}>
            <img src={club.bookCover} alt={club.bookTitle} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} style={{ color: c.accentText }} />
            <span style={{ fontSize: '0.75rem', color: c.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Book Club</span>
          </div>
          <h1 style={{ fontFamily: '"Lora", serif', fontSize: '1.4rem', fontWeight: 700, color: c.textPrimary, lineHeight: 1.2 }}>
            {club.bookTitle}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="px-2 py-0.5 rounded-md text-xs font-mono" style={{ backgroundColor: c.surface2, color: c.textSecondary, letterSpacing: '0.12em' }}>
              {club.id}
            </span>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: c.accentText, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy invite link</>}
            </button>
          </div>
        </div>
      </div>

      {/* Member progress */}
      <div className="rounded-xl overflow-hidden mb-8" style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${c.border}` }}>
          <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem' }}>
            Members ({club.members.length})
          </h2>
        </div>
        {club.members.length === 0 ? (
          <p className="px-5 py-4 text-sm" style={{ color: c.textMuted }}>No members yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: c.border }}>
            {club.members.map(m => (
              <div key={m.name} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.9rem' }}>
                    {m.name}
                    {m.name.toLowerCase() === memberName.toLowerCase() && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: c.accentBg, color: c.accentText }}>you</span>
                    )}
                  </span>
                  {m.progress && (
                    <span style={{ fontSize: '0.78rem', color: c.textSecondary }}>{m.progress}</span>
                  )}
                </div>
                {m.note && (
                  <p style={{ fontSize: '0.83rem', color: c.textSecondary, fontStyle: 'italic', lineHeight: 1.5 }}>"{m.note}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Update your progress */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${c.border}` }}>
          <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem' }}>
            Update my progress
          </h2>
        </div>
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-3">
          <div>
            <label style={{ fontSize: '0.78rem', color: c.textSecondary, display: 'block', marginBottom: 5 }}>Where I am</label>
            <input
              type="text"
              value={progress}
              onChange={e => setProgress(e.target.value)}
              placeholder="e.g. Chapter 12, page 230, finished"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: c.textSecondary, display: 'block', marginBottom: 5 }}>My thoughts (no spoilers!)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What do you think so far?"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="self-start px-5 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function BookClub() {
  const { id } = useParams()
  const [searchParams] = useState(() => new URLSearchParams(window.location.search))
  const memberName = searchParams.get('name') || ''

  if (!id) return <CreateClub />
  return <ClubView clubId={id.toUpperCase()} memberName={memberName} />
}
