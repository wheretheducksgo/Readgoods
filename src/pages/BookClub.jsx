import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Users, ArrowLeft, Copy, Check, BookOpen, ChevronRight } from 'lucide-react'
import { c } from '../lib/theme'

const API = ''
const MY_CLUBS_KEY = 'readgoods_my_clubs'

function getMyClubs() {
  try { return JSON.parse(localStorage.getItem(MY_CLUBS_KEY) || '[]') } catch { return [] }
}
function saveMyClub(club) {
  const clubs = getMyClubs().filter(c => c.id !== club.id)
  localStorage.setItem(MY_CLUBS_KEY, JSON.stringify([club, ...clubs]))
}

// ── Join gate (shown when visiting a club link without a name) ────────────────

function JoinGate({ clubId, onJoin }) {
  const [name, setName] = useState('')
  const [club, setClub] = useState(null)
  const [clubNotFound, setClubNotFound] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API}/api/club/${clubId}`, { signal: controller.signal })
      .then(r => {
        if (r.ok) return r.json()
        if (r.status === 404) { setClubNotFound(true); return null }
        setFetchError(true); return null
      })
      .then(d => { if (d) setClub(d) })
      .catch(err => { if (err.name !== 'AbortError') setFetchError(true) })
    return () => controller.abort()
  }, [clubId, retryCount])

  function handleJoin(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const url = new URL(window.location.href)
    url.searchParams.set('name', trimmed)
    window.history.replaceState({}, '', url.toString())
    onJoin(trimmed)
  }

  if (fetchError) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p style={{ color: c.textSecondary, fontSize: '0.95rem' }}>Couldn't reach the server. Please try again.</p>
        <button onClick={() => { setFetchError(false); setClubNotFound(false); setClub(null); setRetryCount(n => n + 1) }} className="mt-4 inline-block text-sm" style={{ color: c.accentText, background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
      </div>
    )
  }

  if (clubNotFound) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p style={{ color: c.textSecondary, fontSize: '0.95rem' }}>This club link doesn't seem to exist.</p>
        <Link to="/club/new" className="mt-4 inline-block text-sm" style={{ color: c.accentText }}>← Start a new club</Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      {club && (
        <div className="mb-8">
          {club.bookCover && (
            <div className="mx-auto mb-4 rounded-xl overflow-hidden shadow-lg" style={{ width: 80, height: 120 }}>
              <img src={club.bookCover} alt={club.bookTitle} className="w-full h-full object-cover" />
            </div>
          )}
          <p style={{ fontSize: '0.75rem', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Book Club</p>
          <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 700, color: c.textPrimary, fontSize: '1.4rem' }}>
            {club.bookTitle}
          </h1>
          <p style={{ color: c.textSecondary, fontSize: '0.85rem', marginTop: 4 }}>
            {club.members.length} member{club.members.length !== 1 ? 's' : ''} reading
          </p>
        </div>
      )}

      <div className="rounded-2xl p-6" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
        <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1.05rem', marginBottom: 4 }}>
          What's your name?
        </h2>
        <p style={{ color: c.textSecondary, fontSize: '0.83rem', marginBottom: 20 }}>
          This is how your progress will appear to other members.
        </p>
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
          />
          <button
            type="submit"
            disabled={!name.trim() || !club}
            className="w-full rounded-lg py-2.5 text-sm font-medium"
            style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: (name.trim() && club) ? 'pointer' : 'not-allowed', opacity: (name.trim() && club) ? 1 : 0.6 }}
          >
            {club ? 'Join club' : 'Loading…'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Create club form ──────────────────────────────────────────────────────────

function CreateClub() {
  const navigate = useNavigate()
  const [bookTitle, setBookTitle] = useState('')
  const [bookCover, setBookCover] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const myClubs = getMyClubs()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!bookTitle.trim() || !creatorName.trim()) return
    const coverUrl = bookCover.trim() || null
    if (coverUrl) {
      try {
        const u = new URL(coverUrl)
        if (u.protocol !== 'https:') { setError('Cover URL must start with https://'); return }
      } catch { setError('Cover URL is not valid.'); return }
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/club`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: Date.now().toString(),
          bookTitle: bookTitle.trim(),
          bookCover: coverUrl,
          creatorName: creatorName.trim(),
        }),
      })
      const data = await res.json()
      if (data.clubId) {
        saveMyClub({ id: data.clubId, bookTitle: bookTitle.trim(), bookCover: coverUrl, createdAt: Date.now() })
        navigate(`/club/${data.clubId}?name=${encodeURIComponent(creatorName.trim())}`)
      } else {
        setError('Could not create club.')
      }
    } catch {
      setError('Server not available.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    backgroundColor: c.surface2,
    color: c.textPrimary,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Home
      </Link>

      <h1 style={{ fontFamily: '"Lora", serif', fontSize: '1.6rem', fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>
        Book Club
      </h1>
      <p style={{ color: c.textSecondary, fontSize: '0.9rem', marginBottom: 28 }}>
        Start a club and share the link — everyone tracks progress together.
      </p>

      {/* My clubs */}
      {myClubs.length > 0 && (
        <div className="rounded-xl mb-8 overflow-hidden" style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${c.border}` }}>
            <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem' }}>
              My clubs
            </h2>
          </div>
          <div>
            {myClubs.map(club => (
              <Link
                key={club.id}
                to={`/club/${club.id}`}
                className="flex items-center gap-3 px-4 py-3 group"
                style={{ borderBottom: `1px solid ${c.borderSoft}`, textDecoration: 'none' }}
              >
                {club.bookCover ? (
                  <div className="rounded overflow-hidden flex-shrink-0" style={{ width: 32, height: 48 }}>
                    <img src={club.bookCover} alt={club.bookTitle} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 48, backgroundColor: c.surface2 }}>
                    <BookOpen size={14} style={{ color: c.textMuted }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: c.textPrimary }}>{club.bookTitle}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: c.textMuted, letterSpacing: '0.08em' }}>{club.id}</p>
                </div>
                <ChevronRight size={14} style={{ color: c.textMuted, flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="rounded-xl p-5 mb-6" style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
        <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem', marginBottom: 16 }}>
          Start a new club
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: '0.78rem', color: c.textSecondary, display: 'block', marginBottom: 6 }}>Book title *</label>
            <input type="text" value={bookTitle} onChange={e => setBookTitle(e.target.value)} placeholder="e.g. The Name of the Wind" required style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: c.textSecondary, display: 'block', marginBottom: 6 }}>Cover image URL (optional)</label>
            <input type="url" value={bookCover} onChange={e => setBookCover(e.target.value)} placeholder="https://…" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: c.textSecondary, display: 'block', marginBottom: 6 }}>Your name *</label>
            <input type="text" value={creatorName} onChange={e => setCreatorName(e.target.value)} placeholder="e.g. Alex" required style={inputStyle} />
          </div>
          {error && <p style={{ color: '#e55', fontSize: '0.83rem' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg py-2.5 text-sm font-medium"
            style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, border: 'none' }}
          >
            {loading ? 'Creating…' : 'Create Club'}
          </button>
        </form>
      </div>

      {/* Join by code */}
      <div className="rounded-xl p-5" style={{ border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
        <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem', marginBottom: 12 }}>
          Join with a code
        </h2>
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
        style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}`, letterSpacing: '0.1em' }}
      />
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        className="rounded-lg px-3 py-2 text-sm outline-none flex-1"
        style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
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
      const me = data.members.find(m => (m.name || '').toLowerCase() === memberName.toLowerCase())
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
    const inviteUrl = `${window.location.origin}/club/${clubId}`
    navigator.clipboard.writeText(inviteUrl).then(() => {
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
      <Link to="/club/new" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> My Clubs
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
          <p className="px-5 py-4 text-sm" style={{ color: c.textMuted }}>No members yet. Share the invite link to get started.</p>
        ) : (
          <div>
            {club.members.map((m, i) => (
              <div key={m.name} className="px-5 py-4" style={{ borderTop: i > 0 ? `1px solid ${c.border}` : 'none' }}>
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
            style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, border: 'none' }}
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
  const [memberName, setMemberName] = useState(searchParams.get('name') || '')

  if (!id) return <CreateClub />
  if (!memberName) return <JoinGate clubId={id.toUpperCase()} onJoin={setMemberName} />
  return <ClubView clubId={id.toUpperCase()} memberName={memberName} />
}
