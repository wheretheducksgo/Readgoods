import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_reading_sessions'

function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
function lsSet(v) { localStorage.setItem(KEY, JSON.stringify(v)) }

export async function logSession({ bookId, bookTitle, date, minutes, pages }) {
  const uid = getUserId()
  if (!uid) {
    const s = lsGet()
    s.push({ id: String(Date.now()), bookId, bookTitle, date, minutes, pages: pages || null })
    lsSet(s)
    return
  }
  await supabase.from('reading_sessions').insert({
    user_id: uid, book_id: bookId, book_title: bookTitle, date, minutes,
    pages: pages || null,
  })
}

export async function deleteSession(id) {
  const uid = getUserId()
  if (!uid) { lsSet(lsGet().filter(s => s.id !== id)); return }
  await supabase.from('reading_sessions').delete().eq('id', id).eq('user_id', uid)
}

export async function getSessions() {
  const uid = getUserId()
  if (!uid) {
    return lsGet().sort((a, b) => b.date.localeCompare(a.date))
  }
  const { data } = await supabase
    .from('reading_sessions')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false })
  return (data || []).map(r => ({
    id: r.id, bookId: r.book_id, bookTitle: r.book_title,
    date: r.date, minutes: r.minutes, pages: r.pages,
  }))
}

// Aggregate sessions into stats
export function computeStats(sessions) {
  const byDate = {}
  for (const s of sessions) {
    byDate[s.date] = (byDate[s.date] || 0) + s.minutes
  }

  // Streak: count consecutive days ending today (or yesterday if today has no session)
  const today = new Date().toISOString().slice(0, 10)
  let streak = 0
  const cur = new Date()
  if (!byDate[today]) cur.setDate(cur.getDate() - 1)
  for (let i = 0; i < 365; i++) {
    const key = cur.toISOString().slice(0, 10)
    if (byDate[key]) { streak++; cur.setDate(cur.getDate() - 1) }
    else break
  }

  // This week (Mon–Sun)
  const now = new Date()
  const dow = now.getDay()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  weekStart.setHours(0, 0, 0, 0)

  const monthKey = today.slice(0, 7)
  let weekMinutes = 0, monthMinutes = 0, totalMinutes = 0
  for (const [date, mins] of Object.entries(byDate)) {
    totalMinutes += mins
    if (date.startsWith(monthKey)) monthMinutes += mins
    if (new Date(date + 'T12:00:00') >= weekStart) weekMinutes += mins
  }

  return { streak, weekMinutes, monthMinutes, totalMinutes, totalSessions: sessions.length, byDate }
}

// Build a 16-week grid for the heatmap (newest week rightmost)
export function buildHeatmapGrid(byDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Start from the Monday 16 weeks ago
  const start = new Date(today)
  const daysBack = (today.getDay() === 0 ? 6 : today.getDay() - 1) + 7 * 15
  start.setDate(today.getDate() - daysBack)

  const weeks = []
  const d = new Date(start)
  for (let w = 0; w < 16; w++) {
    const week = []
    for (let day = 0; day < 7; day++) {
      const key = d.toISOString().slice(0, 10)
      week.push({ date: key, minutes: byDate[key] || 0, future: d > today })
      d.setDate(d.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

export function fmtMinutes(mins) {
  if (!mins) return '0 min'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m}m`
  if (!m) return `${h}h`
  return `${h}h ${m}m`
}
