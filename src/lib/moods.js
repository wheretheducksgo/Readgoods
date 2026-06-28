const KEY = 'readgoods_moods'

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

export function getMoods() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function getBookMoods(bookId) {
  return getMoods()[bookId] || []
}

export function setBookMoods(bookId, moodIds) {
  const all = getMoods()
  if (moodIds.length) all[bookId] = moodIds
  else delete all[bookId]
  localStorage.setItem(KEY, JSON.stringify(all))
}
