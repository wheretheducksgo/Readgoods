import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_ratings'
const REVIEW_KEY = 'readgoods_reviews'

function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
function lsSet(d) { localStorage.setItem(KEY, JSON.stringify(d)) }
function lsGetReviews() { try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') } catch { return {} } }
function lsSetReviews(d) { localStorage.setItem(REVIEW_KEY, JSON.stringify(d)) }

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

export async function getBookReview(bookId) {
  const uid = getUserId()
  if (!uid) return lsGetReviews()[bookId] ?? ''
  const { data } = await supabase
    .from('ratings')
    .select('review')
    .eq('user_id', uid)
    .eq('book_id', bookId)
    .maybeSingle()
  return data?.review ?? ''
}

export async function setBookReview(bookId, text) {
  const uid = getUserId()
  if (!uid) {
    const all = lsGetReviews()
    if (!text) delete all[bookId]
    else all[bookId] = text
    lsSetReviews(all)
    return
  }
  await supabase.from('ratings').upsert(
    { user_id: uid, book_id: bookId, review: text },
    { onConflict: 'user_id,book_id' }
  )
}
