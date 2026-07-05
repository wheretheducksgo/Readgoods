import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_reading_log'

function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
function lsSet(log) { localStorage.setItem(KEY, JSON.stringify(log)) }

export async function getLog() {
  const uid = getUserId()
  if (!uid) return lsGet()
  const { data } = await supabase.from('reading_log').select('*').eq('user_id', uid)
  const log = {}
  for (const row of data || []) {
    log[row.book_id] = {
      totalPages: row.page_count,
      startDate: row.start_date ? new Date(row.start_date).getTime() : null,
      finishDate: row.finish_date ? new Date(row.finish_date).getTime() : null,
      sessions: row.sessions || [],
    }
  }
  return log
}

export async function getBookLog(bookId) {
  const uid = getUserId()
  if (!uid) return lsGet()[bookId] || null
  const { data } = await supabase.from('reading_log').select('*').eq('user_id', uid).eq('book_id', bookId).maybeSingle()
  if (!data) return null
  return {
    totalPages: data.page_count,
    startDate: data.start_date ? new Date(data.start_date).getTime() : null,
    finishDate: data.finish_date ? new Date(data.finish_date).getTime() : null,
    sessions: data.sessions || [],
  }
}

export async function startReading(bookId, totalPages) {
  const uid = getUserId()
  if (!uid) {
    const log = lsGet()
    if (!log[bookId]) {
      log[bookId] = { startDate: Date.now(), totalPages: totalPages || null, sessions: [] }
      lsSet(log)
    } else if (totalPages && !log[bookId].totalPages) {
      log[bookId].totalPages = totalPages
      lsSet(log)
    }
    return
  }
  const existing = await getBookLog(bookId)
  if (!existing) {
    await supabase.from('reading_log').upsert(
      { user_id: uid, book_id: bookId, page_count: totalPages || null, start_date: new Date().toISOString(), sessions: [] },
      { onConflict: 'user_id,book_id' }
    )
  } else if (totalPages && !existing.totalPages) {
    await supabase.from('reading_log').update({ page_count: totalPages }).eq('user_id', uid).eq('book_id', bookId)
  }
}

export async function logSession(bookId, pagesRead) {
  const uid = getUserId()
  if (!uid) {
    const log = lsGet()
    if (!log[bookId]) log[bookId] = { startDate: Date.now(), totalPages: null, sessions: [] }
    log[bookId].sessions.push({ date: Date.now(), pagesRead })
    lsSet(log)
    return log[bookId]
  }
  const entry = await getBookLog(bookId)
  const sessions = [...(entry?.sessions || []), { date: Date.now(), pagesRead }]
  await supabase.from('reading_log').upsert(
    { user_id: uid, book_id: bookId, sessions, start_date: entry?.startDate ? new Date(entry.startDate).toISOString() : new Date().toISOString() },
    { onConflict: 'user_id,book_id' }
  )
  return { ...entry, sessions }
}

export async function finishReading(bookId) {
  const uid = getUserId()
  if (!uid) {
    const log = lsGet()
    if (log[bookId]) { log[bookId].finishDate = Date.now(); lsSet(log) }
    return
  }
  await supabase.from('reading_log').update({ finish_date: new Date().toISOString() }).eq('user_id', uid).eq('book_id', bookId)
}

export async function getPaceStats(bookId) {
  const entry = await getBookLog(bookId)
  if (!entry) return null
  const pagesRead = (entry.sessions || []).reduce((s, x) => s + x.pagesRead, 0)
  const msIn = Date.now() - (entry.startDate || Date.now())
  const daysIn = Math.max(msIn / 86400000, 1)
  const pagesPerDay = pagesRead / daysIn
  const totalPages = entry.totalPages
  const pctDone = totalPages ? Math.min(pagesRead / totalPages, 1) : null
  const pagesLeft = totalPages ? totalPages - pagesRead : null
  const daysRemaining = (pagesLeft !== null && pagesPerDay > 0) ? pagesLeft / pagesPerDay : null
  return { pagesRead, pagesPerDay, daysIn, daysRemaining, pctDone, totalPages }
}

export async function getAllFinishedLogs() {
  const log = await getLog()
  return Object.entries(log)
    .filter(([, e]) => e.finishDate)
    .map(([bookId, e]) => ({ bookId, ...e }))
}
