import { supabase } from './supabase'

export async function getCommunityBooks({ query = '', tags = [], minRating = 0 } = {}) {
  let cacheQuery = supabase.from('book_cache').select('*')
  if (query) cacheQuery = cacheQuery.or(`title.ilike.%${query}%,author.ilike.%${query}%`)

  const { data: books, error } = await cacheQuery
  if (error || !books?.length) return []

  const bookIds = books.map(b => b.book_id)

  const [{ data: ratings }, { data: moods }] = await Promise.all([
    supabase.from('ratings').select('book_id, rating, review').in('book_id', bookIds),
    supabase.from('moods').select('book_id, moods').in('book_id', bookIds),
  ])

  const ratingsByBook = {}
  for (const r of ratings || []) {
    if (!ratingsByBook[r.book_id]) ratingsByBook[r.book_id] = []
    ratingsByBook[r.book_id].push(r)
  }

  const moodsByBook = {}
  for (const m of moods || []) {
    if (!moodsByBook[m.book_id]) moodsByBook[m.book_id] = new Set()
    for (const tag of m.moods || []) moodsByBook[m.book_id].add(tag)
  }

  let results = books.map(book => {
    const bookRatings = ratingsByBook[book.book_id] || []
    const bookMoods = [...(moodsByBook[book.book_id] || [])]
    const ratingCount = bookRatings.length
    const avgRating = ratingCount > 0
      ? bookRatings.reduce((s, r) => s + r.rating, 0) / ratingCount
      : null
    const reviews = bookRatings.filter(r => r.review).map(r => r.review)
    return { ...book, ratingCount, avgRating, reviews, moods: bookMoods }
  }).filter(b => b.ratingCount > 0 || b.moods.length > 0)

  if (minRating > 0) results = results.filter(b => b.avgRating != null && b.avgRating >= minRating)
  if (tags.length > 0) results = results.filter(b => tags.every(t => b.moods.includes(t)))

  return results.sort((a, b) => (b.ratingCount * 2 + b.moods.length) - (a.ratingCount * 2 + a.moods.length))
}

export async function getAllCommunityTags() {
  const { data } = await supabase.from('moods').select('moods')
  const all = new Set()
  for (const row of data || []) for (const tag of row.moods || []) all.add(tag)
  return [...all].sort()
}
