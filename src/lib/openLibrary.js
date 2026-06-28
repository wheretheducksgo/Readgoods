const BASE = 'https://openlibrary.org'

export async function getWorkData(isbn) {
  if (!isbn) return null
  try {
    const res = await fetch(`${BASE}/isbn/${isbn}.json`)
    if (!res.ok) return null
    const edition = await res.json()
    const workKey = edition.works?.[0]?.key
    if (!workKey) return null
    const workRes = await fetch(`${BASE}${workKey}.json`)
    if (!workRes.ok) return null
    return workRes.json()
  } catch {
    return null
  }
}

export async function getSeriesInfo(isbn) {
  try {
    const work = await getWorkData(isbn)
    if (!work) return null
    const series = work.series || work.subject_people || null
    return { series, subjects: work.subjects?.slice(0, 10) || [] }
  } catch {
    return null
  }
}

export async function searchByTitle(title) {
  try {
    const res = await fetch(`${BASE}/search.json?title=${encodeURIComponent(title)}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,isbn`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.docs || []).map(d => ({
      key: d.key,
      title: d.title,
      authors: d.author_name || [],
      year: d.first_publish_year,
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      isbn: d.isbn?.[0] || null,
    }))
  } catch {
    return []
  }
}
