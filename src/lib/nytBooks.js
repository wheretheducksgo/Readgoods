const BASE = 'https://api.nytimes.com/svc/books/v3'
const KEY = import.meta.env.VITE_NYT_KEY || ''

export async function getBestsellers(list = 'hardcover-fiction') {
  if (!KEY) return []
  try {
    const url = `${BASE}/lists/current/${list}.json?api-key=${KEY}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.results?.books || []).map(b => ({
      rank: b.rank,
      title: b.title,
      author: b.author,
      description: b.description,
      cover: b.book_image,
      isbn: b.primary_isbn13,
      weeksOnList: b.weeks_on_list,
      amazonUrl: b.amazon_product_url,
    }))
  } catch {
    return []
  }
}

export async function getListNames() {
  if (!KEY) return []
  try {
    const res = await fetch(`${BASE}/lists/names.json?api-key=${KEY}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  } catch {
    return []
  }
}
