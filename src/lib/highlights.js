import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_highlights'

function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }

export async function getBookHighlights(bookId) {
  const uid = getUserId()
  if (!uid) return lsGet()[bookId] || []
  const { data } = await supabase.from('highlights').select('*').eq('user_id', uid).eq('book_id', bookId).order('added_at', { ascending: false })
  return (data || []).map(r => ({ id: r.id, text: r.text, page: r.page, addedAt: new Date(r.added_at).getTime() }))
}

export async function addHighlight(bookId, text, page) {
  const uid = getUserId()
  if (!uid) {
    const all = lsGet()
    if (!all[bookId]) all[bookId] = []
    const h = { id: Date.now(), text: text.trim(), page: page || null, addedAt: Date.now() }
    all[bookId].unshift(h)
    localStorage.setItem(KEY, JSON.stringify(all))
    return all[bookId]
  }
  const { data } = await supabase.from('highlights').insert({ user_id: uid, book_id: bookId, text: text.trim(), page: page || null }).select().single()
  return [{ id: data.id, text: data.text, page: data.page, addedAt: new Date(data.added_at).getTime() }]
}

export async function removeHighlight(bookId, id) {
  const uid = getUserId()
  if (!uid) {
    const all = lsGet()
    if (all[bookId]) {
      all[bookId] = all[bookId].filter(h => h.id !== id)
      if (!all[bookId].length) delete all[bookId]
      localStorage.setItem(KEY, JSON.stringify(all))
    }
    return
  }
  await supabase.from('highlights').delete().eq('user_id', uid).eq('id', id)
}

export async function getRandomHighlight() {
  const uid = getUserId()
  if (!uid) {
    const all = lsGet()
    const entries = Object.entries(all).flatMap(([bookId, hs]) => hs.map(h => ({ ...h, bookId })))
    if (!entries.length) return null
    return entries[Math.floor(Math.random() * entries.length)]
  }
  const { data } = await supabase.from('highlights').select('*').eq('user_id', uid)
  if (!data?.length) return null
  const row = data[Math.floor(Math.random() * data.length)]
  return { id: row.id, text: row.text, page: row.page, bookId: row.book_id }
}
