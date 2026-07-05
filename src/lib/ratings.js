import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_ratings'

function lsGet() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function lsSet(d) { localStorage.setItem(KEY, JSON.stringify(d)) }

export async function getBookRating(bookId) {
  const uid = getUserId()
  if (!uid) return lsGet()[bookId] ?? null
  const { data } = await supabase
    .from('ratings')
    .select('rating')
    .eq('user_id', uid)
    .eq('book_id', bookId)
    .maybeSingle()
  return data?.rating ?? null
}

export async function setBookRating(bookId, rating) {
  const uid = getUserId()
  if (!uid) {
    const all = lsGet()
    if (rating === null) delete all[bookId]
    else all[bookId] = rating
    lsSet(all)
    return
  }
  if (rating === null) {
    await supabase.from('ratings').delete().eq('user_id', uid).eq('book_id', bookId)
  } else {
    await supabase.from('ratings').upsert(
      { user_id: uid, book_id: bookId, rating },
      { onConflict: 'user_id,book_id' }
    )
  }
}
