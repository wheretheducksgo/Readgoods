const KEY = 'readgoods_reading_log'

export function getLog() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function saveLog(log) {
  localStorage.setItem(KEY, JSON.stringify(log))
}

export function getBookLog(bookId) {
  return getLog()[bookId] || null
}

export function startReading(bookId, totalPages) {
  const log = getLog()
  if (!log[bookId]) {
    log[bookId] = { startDate: Date.now(), totalPages: totalPages || null, sessions: [] }
    saveLog(log)
  } else if (totalPages && !log[bookId].totalPages) {
    log[bookId].totalPages = totalPages
    saveLog(log)
  }
}

export function logSession(bookId, pagesRead) {
  const log = getLog()
  if (!log[bookId]) log[bookId] = { startDate: Date.now(), totalPages: null, sessions: [] }
  log[bookId].sessions.push({ date: Date.now(), pagesRead })
  saveLog(log)
  return log[bookId]
}

export function finishReading(bookId) {
  const log = getLog()
  if (log[bookId]) {
    log[bookId].finishDate = Date.now()
    saveLog(log)
  }
}

// Returns { pagesRead, pagesPerDay, daysIn, daysRemaining, pctDone } or null
export function getPaceStats(bookId) {
  const entry = getBookLog(bookId)
  if (!entry) return null

  const pagesRead = entry.sessions.reduce((s, x) => s + x.pagesRead, 0)
  const msIn = Date.now() - entry.startDate
  const daysIn = Math.max(msIn / 86400000, 1)
  const pagesPerDay = pagesRead / daysIn

  const totalPages = entry.totalPages
  const pctDone = totalPages ? Math.min(pagesRead / totalPages, 1) : null
  const pagesLeft = totalPages ? totalPages - pagesRead : null
  const daysRemaining = (pagesLeft !== null && pagesPerDay > 0) ? pagesLeft / pagesPerDay : null

  return { pagesRead, pagesPerDay, daysIn, daysRemaining, pctDone, totalPages }
}

export function getAllFinishedLogs() {
  const log = getLog()
  return Object.entries(log)
    .filter(([, e]) => e.finishDate)
    .map(([bookId, e]) => ({ bookId, ...e }))
}
