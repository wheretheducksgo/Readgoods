import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_notes'

function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }

export async function getNote(bookId) {
  const uid = getUserId()
  if (!uid) return lsGet()[bookId]?.text || ''
  const { data } = await supabase.from('notes').select('text').eq('user_id', uid).eq('book_id', bookId).maybeSingle()
  return data?.text || ''
}

export async function saveNote(bookId, text) {
  const uid = getUserId()
  if (!uid) {
    const notes = lsGet()
    if (text.trim()) notes[bookId] = { text, updatedAt: Date.now() }
    else delete notes[bookId]
    localStorage.setItem(KEY, JSON.stringify(notes))
    return
  }
  if (text.trim()) {
    await supabase.from('notes').upsert({ user_id: uid, book_id: bookId, text, updated_at: new Date().toISOString() }, { onConflict: 'user_id,book_id' })
  } else {
    await supabase.from('notes').delete().eq('user_id', uid).eq('book_id', bookId)
  }
}

export async function getAllNotes() {
  const uid = getUserId()
  if (!uid) {
    const raw = lsGet()
    return Object.entries(raw).map(([bookId, v]) => ({ bookId, text: v.text || '' }))
  }
  const { data } = await supabase.from('notes').select('book_id, text').eq('user_id', uid)
  return (data || []).map(r => ({ bookId: r.book_id, text: r.text }))
}
