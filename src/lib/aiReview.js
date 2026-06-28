export async function getBookReviews(book) {
  try {
    const params = new URLSearchParams({
      title: book.title,
      author: book.authors?.[0] || '',
    })
    const res = await fetch(`/api/reviews?${params}`)
    if (!res.ok) return { found: false, warning: 'Proxy error.' }
    return await res.json()
  } catch {
    return { found: false, warning: 'Review server not reachable.' }
  }
}

export async function getAISummary({ title, author, avgRating, ratingCount, breakdown }) {
  try {
    const params = new URLSearchParams({
      title,
      author: author || '',
      avgRating: avgRating ?? '',
      ratingCount: ratingCount ?? '',
      breakdown: breakdown ? JSON.stringify(breakdown) : '',
    })
    const res = await fetch(`/api/ai-summary?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.summary || null
  } catch {
    return null
  }
}
