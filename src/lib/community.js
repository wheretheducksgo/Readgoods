import { supabase } from './supabase'
import { SEED_TAGS } from '../data/seedTags'
import { SEED_REVIEWS } from '../data/seedReviews'
import { BOOKS, BOOK_BY_ID } from '../data/books'

// Build a lookup of local books for community display
const LOCAL_BOOK_CACHE = BOOKS.map(b => ({
  book_id: b.id,
  title: b.title,
  author: b.authors?.[0] || '',
  cover: b.cover || null,
}))

export async function getCommunityBooks({ query = '', tags = [], minRating = 0 } = {}) {
  // Merge local books with any that have been cached in Supabase
  const { data: cachedBooks } = await supabase.from('book_cache').select('*')
  const cachedIds = new Set((cachedBooks || []).map(b => b.book_id))

  // Use local books as base; overlay any Supabase-cached metadata
  let allBooks = LOCAL_BOOK_CACHE.map(lb => {
    const cached = (cachedBooks || []).find(c => c.book_id === lb.book_id)
    return cached || lb
  })

  if (query) {
    const q = query.toLowerCase()
    allBooks = allBooks.filter(b =>
      b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)
    )
  }

  const bookIds = allBooks.map(b => b.book_id)

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

  let results = allBooks.map(book => {
    const bookRatings = ratingsByBook[book.book_id] || []
    // Merge seed tags with real user tags
    const seedMoods = SEED_TAGS[book.book_id] || []
    const userMoods = moodsByBook[book.book_id] || new Set()
    const bookMoods = [...new Set([...seedMoods, ...userMoods])]
    // Merge seed reviews with real user reviews
    const seedRevs = (SEED_REVIEWS[book.book_id] || []).map(r => ({ rating: r.rating, review: r.text }))
    const userRevs = bookRatings.filter(r => r.review)
    const allRatings = [...seedRevs, ...userRevs]
    const ratingCount = allRatings.length
    const avgRating = ratingCount > 0
      ? allRatings.reduce((s, r) => s + r.rating, 0) / ratingCount
      : null
    const reviews = allRatings.map(r => r.review).filter(Boolean)
    return { ...book, ratingCount, avgRating, reviews, moods: bookMoods }
  }).filter(b => b.ratingCount > 0 || b.moods.length > 0)

  if (minRating > 0) results = results.filter(b => b.avgRating != null && b.avgRating >= minRating)
  if (tags.length > 0) results = results.filter(b => tags.every(t => b.moods.includes(t)))

  return results.sort((a, b) => (b.ratingCount * 2 + b.moods.length) - (a.ratingCount * 2 + a.moods.length))
}

export async function getAllCommunityTags() {
  const { data } = await supabase.from('moods').select('moods')
  const all = new Set()
  // Include all seed tags
  for (const tags of Object.values(SEED_TAGS)) for (const t of tags) all.add(t)
  // Merge real user tags
  for (const row of data || []) for (const tag of row.moods || []) all.add(tag)
  return [...all].sort()
}
