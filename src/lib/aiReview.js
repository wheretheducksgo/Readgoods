import { supabase } from './supabase'
import { SEED_REVIEWS } from '../data/seedReviews'

export async function getBookReviews(book) {
  try {
    const seedRevs = SEED_REVIEWS[book.id] || []
    const { data: userRatings } = await supabase
      .from('ratings')
      .select('rating, review')
      .eq('book_id', book.id)

    const allRatings = [
      ...seedRevs.map(r => ({ rating: r.rating, review: r.text })),
      ...(userRatings || []).map(r => ({ rating: r.rating, review: r.review })),
    ].filter(r => r.rating != null)

    if (allRatings.length === 0) return { found: false }

    const avgRating = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of allRatings) {
      const star = Math.round(r.rating)
      if (ratingBreakdown[star] !== undefined) ratingBreakdown[star]++
    }

    return {
      found: true,
      avgRating,
      ratingCount: allRatings.length,
      ratingBreakdown,
      reviews: allRatings.map(r => r.review).filter(Boolean),
    }
  } catch {
    return { found: false }
  }
}

export async function getAISummary() {
  return null
}
