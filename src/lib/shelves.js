import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_shelves'
const defaults = { 'want-to-read': [], 'currently-reading': [], 'read': [] }

function lsGet() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { ...defaults } } catch { return { ...defaults } }
}
function lsSet(s) { localStorage.setItem(KEY, JSON.stringify(s)) }

export async function getShelves() {
  const uid = getUserId()
  if (!uid) return lsGet()
  const { data } = await supabase.from('shelves').select('*').eq('user_id', uid)
  const shelves = { 'want-to-read': [], 'currently-reading': [], 'read': [] }
  for (const row of data || []) {
    if (!shelves[row.shelf]) shelves[row.shelf] = []
    shelves[row.shelf].push({ ...row.book_data, addedAt: new Date(row.added_at).getTime() })
  }
  for (const shelf of Object.keys(shelves)) {
    shelves[shelf].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
  }
  return shelves
}

export async function getBookShelf(bookId) {
  const uid = getUserId()
  if (!uid) {
    const shelves = lsGet()
    for (const [shelf, books] of Object.entries(shelves)) {
      if (books.some(b => b.id === bookId)) return shelf
    }
    return null
  }
  const { data } = await supabase.from('shelves').select('shelf').eq('user_id', uid).eq('book_id', bookId).maybeSingle()
  return data?.shelf || null
}

export async function addToShelf(shelf, book) {
  const uid = getUserId()
  if (!uid) {
    const shelves = lsGet()
    for (const key of Object.keys(shelves)) shelves[key] = shelves[key].filter(b => b.id !== book.id)
    shelves[shelf] = [{ ...book, addedAt: Date.now() }, ...shelves[shelf]]
    lsSet(shelves)
    return
  }
  await Promise.all([
    supabase.from('shelves').upsert(
      { user_id: uid, book_id: book.id, shelf, book_data: book, added_at: new Date().toISOString() },
      { onConflict: 'user_id,book_id' }
    ),
    supabase.from('book_cache').upsert(
      { book_id: book.id, title: book.title, author: book.authors?.[0] || '', cover: book.cover || null },
      { onConflict: 'book_id' }
    ),
  ])
}

export async function removeFromShelves(bookId) {
  const uid = getUserId()
  if (!uid) {
    const shelves = lsGet()
    for (const key of Object.keys(shelves)) shelves[key] = shelves[key].filter(b => b.id !== bookId)
    lsSet(shelves)
    return
  }
  await supabase.from('shelves').delete().eq('user_id', uid).eq('book_id', bookId)
}

export async function getRecentBooks(limit = 10) {
  const uid = getUserId()
  if (!uid) {
    const shelves = lsGet()
    const all = Object.entries(shelves).flatMap(([shelf, books]) => books.map(b => ({ ...b, shelf })))
    return all.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, limit)
  }
  const { data } = await supabase.from('shelves').select('*').eq('user_id', uid).order('added_at', { ascending: false }).limit(limit)
  return (data || []).map(row => ({ ...row.book_data, shelf: row.shelf, addedAt: new Date(row.added_at).getTime() }))
}
