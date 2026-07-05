import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_moods'

function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }

export const ALL_MOODS = [
  { id: 'cozy',             label: 'Cozy',             emoji: '☕' },
  { id: 'dark',             label: 'Dark',             emoji: '🌑' },
  { id: 'fast-paced',       label: 'Fast-paced',       emoji: '⚡' },
  { id: 'slow-burn',        label: 'Slow burn',        emoji: '🕯️' },
  { id: 'thought-provoking',label: 'Thought-provoking',emoji: '🧠' },
  { id: 'emotional',        label: 'Emotional',        emoji: '💧' },
  { id: 'funny',            label: 'Funny',            emoji: '😂' },
  { id: 'adventurous',      label: 'Adventurous',      emoji: '🗺️' },
  { id: 'romantic',         label: 'Romantic',         emoji: '💛' },
  { id: 'creepy',           label: 'Creepy',           emoji: '👁️' },
  { id: 'inspiring',        label: 'Inspiring',        emoji: '✨' },
  { id: 'informative',      label: 'Informative',      emoji: '📚' },
]

export async function getBookMoods(bookId) {
  const uid = getUserId()
  if (!uid) return lsGet()[bookId] || []
  const { data } = await supabase.from('moods').select('moods').eq('user_id', uid).eq('book_id', bookId).maybeSingle()
  return data?.moods || []
}

export async function setBookMoods(bookId, moodIds) {
  const uid = getUserId()
  if (!uid) {
    const all = lsGet()
    if (moodIds.length) all[bookId] = moodIds
    else delete all[bookId]
    localStorage.setItem(KEY, JSON.stringify(all))
    return
  }
  if (moodIds.length) {
    await supabase.from('moods').upsert({ user_id: uid, book_id: bookId, moods: moodIds }, { onConflict: 'user_id,book_id' })
  } else {
    await supabase.from('moods').delete().eq('user_id', uid).eq('book_id', bookId)
  }
}
