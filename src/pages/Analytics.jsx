import { useState, useEffect } from 'react'
import { Flame, Clock, CalendarDays, BookOpen, Trash2, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getShelves } from '../lib/shelves'
import { logSession, deleteSession, getSessions, computeStats, buildHeatmapGrid, fmtMinutes } from '../lib/analytics'
import { c } from '../lib/theme'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function minuteColor(mins) {
  if (!mins) return c.surface2
  if (mins < 16) return 'rgba(78,143,200,0.25)'
  if (mins < 31) return 'rgba(78,143,200,0.5)'
  if (mins < 61) return 'rgba(78,143,200,0.75)'
  return c.accent
}

function Heatmap({ byDate }) {
  const [tooltip, setTooltip] = useState(null)
  const weeks = buildHeatmapGrid(byDate)

  // Month labels: find first week of each month
  const monthLabels = []
  weeks.forEach((week, wi) => {
    const month = new Date(week[0].date + 'T12:00:00').getMonth()
    if (wi === 0 || new Date(weeks[wi - 1][0].date + 'T12:00:00').getMonth() !== month) {
      monthLabels.push({ wi, label: MONTHS[month] })
    }
  })

  return (
    <div className="relative">
      {/* Month labels */}
      <div className="flex mb-1" style={{ paddingLeft: 32 }}>
        {weeks.map((_, wi) => {
          const ml = monthLabels.find(m => m.wi === wi)
          return (
            <div key={wi} style={{ width: 14, marginRight: 2, fontSize: '0.65rem', color: c.textMuted, flexShrink: 0 }}>
              {ml ? ml.label : ''}
            </div>
          )
        })}
      </div>

      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-2" style={{ paddingTop: 1 }}>
          {DAY_LABELS.map((d, i) => (
            <div key={d} style={{ height: 13, fontSize: '0.6rem', color: c.textMuted, lineHeight: '13px', opacity: i % 2 === 0 ? 1 : 0 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map(cell => (
              <div
                key={cell.date}
                style={{
                  width: 13, height: 13,
                  borderRadius: 2,
                  backgroundColor: cell.future ? 'transparent' : minuteColor(cell.minutes),
                  cursor: cell.minutes ? 'pointer' : 'default',
                  border: cell.future ? 'none' : `1px solid rgba(255,255,255,0.04)`,
                  transition: 'opacity 0.1s',
                }}
                onMouseEnter={e => {
                  if (!cell.future) {
                    const rect = e.target.getBoundingClientRect()
                    setTooltip({ cell, x: rect.left, y: rect.top })
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3" style={{ paddingLeft: 34 }}>
        <span style={{ fontSize: '0.65rem', color: c.textMuted }}>Less</span>
        {[0, 10, 25, 45, 90].map(m => (
          <div key={m} style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: minuteColor(m), border: `1px solid rgba(255,255,255,0.04)` }} />
        ))}
        <span style={{ fontSize: '0.65rem', color: c.textMuted }}>More</span>
      </div>

      {/* Tooltip rendered in a portal-ish fixed div */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg px-3 py-2"
          style={{
            top: tooltip.y - 60, left: tooltip.x - 40,
            backgroundColor: c.surface, border: `1px solid ${c.border}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ color: c.textPrimary, fontWeight: 600 }}>{fmtMinutes(tooltip.cell.minutes)}</div>
          <div style={{ color: c.textMuted }}>{tooltip.cell.date}</div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: c.accentText }} />
        <span style={{ fontSize: '0.75rem', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <span style={{ fontSize: '1.75rem', fontWeight: 700, color: c.textPrimary, fontFamily: '"Lora", serif', lineHeight: 1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: '0.75rem', color: c.textSecondary }}>{sub}</span>}
    </div>
  )
}

export default function Analytics() {
  const { user, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState([])
  const [allBooks, setAllBooks] = useState([])
  const [form, setForm] = useState({ bookId: '', minutes: '', pages: '', date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (authLoading) return
    getSessions().then(setSessions)
    getShelves().then(shelves => {
      const books = Object.values(shelves).flat()
      setAllBooks(books)
      if (books.length && !form.bookId) {
        const current = shelves['currently-reading']?.[0] || books[0]
        setForm(f => ({ ...f, bookId: current.id }))
      }
    })
  }, [authLoading, user?.id ?? null])

  const stats = computeStats(sessions)

  async function handleLog(e) {
    e.preventDefault()
    setFormError('')
    const mins = parseInt(form.minutes, 10)
    if (!form.bookId) { setFormError('Please select a book.'); return }
    if (!mins || mins < 1) { setFormError('Enter a valid number of minutes.'); return }
    const book = allBooks.find(b => b.id === form.bookId)
    setSaving(true)
    await logSession({
      bookId: form.bookId,
      bookTitle: book?.title || form.bookId,
      date: form.date,
      minutes: mins,
      pages: parseInt(form.pages, 10) || null,
    })
    const updated = await getSessions()
    setSessions(updated)
    setForm(f => ({ ...f, minutes: '', pages: '' }))
    setSaving(false)
  }

  async function handleDelete(id) {
    await deleteSession(id)
    setSessions(s => s.filter(x => x.id !== id))
  }

  const inputStyle = {
    backgroundColor: c.surface2,
    border: `1px solid ${c.border}`,
    color: c.textPrimary,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 700, color: c.textPrimary, fontSize: '2rem', marginBottom: 6 }}>
        Reading Analytics
      </h1>
      <p style={{ color: c.textSecondary, fontSize: '0.95rem', marginBottom: 32 }}>
        Track your reading habits and build a daily practice.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Flame}
          label="Streak"
          value={stats.streak}
          sub={stats.streak === 1 ? 'day' : 'days'}
        />
        <StatCard
          icon={Clock}
          label="This week"
          value={fmtMinutes(stats.weekMinutes)}
          sub="reading time"
        />
        <StatCard
          icon={CalendarDays}
          label="This month"
          value={fmtMinutes(stats.monthMinutes)}
          sub="reading time"
        />
        <StatCard
          icon={BookOpen}
          label="All time"
          value={fmtMinutes(stats.totalMinutes)}
          sub={`${stats.totalSessions} session${stats.totalSessions !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Heatmap */}
      <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
        <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1rem', marginBottom: 16 }}>
          Activity — last 16 weeks
        </h2>
        <Heatmap byDate={stats.byDate} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Log session form */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
          <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1rem', marginBottom: 16 }}>
            Log a reading session
          </h2>
          <form onSubmit={handleLog} className="flex flex-col gap-3">
            <div>
              <label style={{ fontSize: '0.75rem', color: c.textMuted, display: 'block', marginBottom: 4 }}>Book</label>
              <select
                value={form.bookId}
                onChange={e => setForm(f => ({ ...f, bookId: e.target.value }))}
                style={inputStyle}
              >
                <option value="">— select a book —</option>
                {allBooks.map(b => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ fontSize: '0.75rem', color: c.textMuted, display: 'block', marginBottom: 4 }}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: c.textMuted, display: 'block', marginBottom: 4 }}>Minutes read</label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  placeholder="e.g. 45"
                  value={form.minutes}
                  onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: c.textMuted, display: 'block', marginBottom: 4 }}>Pages read <span style={{ color: c.textMuted }}>(optional)</span></label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 32"
                value={form.pages}
                onChange={e => setForm(f => ({ ...f, pages: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {formError && <p style={{ fontSize: '0.8rem', color: '#e55' }}>{formError}</p>}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium mt-1"
              style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              <Plus size={14} /> {saving ? 'Saving…' : 'Log session'}
            </button>
          </form>
        </div>

        {/* Recent sessions */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
          <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1rem', marginBottom: 16 }}>
            Recent sessions
          </h2>
          {sessions.length === 0 ? (
            <p style={{ color: c.textMuted, fontSize: '0.875rem' }}>
              No sessions yet. Log your first reading session to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 340 }}>
              {sessions.slice(0, 30).map(s => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: c.surface2 }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: c.textPrimary }}>{s.bookTitle}</p>
                    <p style={{ fontSize: '0.75rem', color: c.textSecondary, marginTop: 2 }}>
                      {fmtMinutes(s.minutes)}
                      {s.pages ? ` · ${s.pages} pages` : ''}
                      {' · '}{s.date}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="flex-shrink-0 p-1 rounded"
                    style={{ color: c.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
