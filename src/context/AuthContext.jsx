import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, setUserId } from '../lib/supabase'

const AuthContext = createContext(null)

async function migrateLocalStorage(userId) {
  const migKey = `sb_migrated_${userId}`
  if (localStorage.getItem(migKey)) return

  try {
    // Shelves
    const lsShelves = JSON.parse(localStorage.getItem('readgoods_shelves') || 'null')
    if (lsShelves) {
      const rows = Object.entries(lsShelves).flatMap(([shelf, books]) =>
        books.map(book => ({ user_id: userId, book_id: book.id, shelf, book_data: book, added_at: new Date(book.addedAt || Date.now()).toISOString() }))
      )
      if (rows.length) await supabase.from('shelves').upsert(rows, { onConflict: 'user_id,book_id', ignoreDuplicates: true })
    }

    // Notes
    const lsNotes = JSON.parse(localStorage.getItem('readgoods_notes') || 'null')
    if (lsNotes) {
      const rows = Object.entries(lsNotes).map(([book_id, v]) => ({
        user_id: userId, book_id, text: v.text || v, updated_at: new Date(v.updatedAt || Date.now()).toISOString(),
      }))
      if (rows.length) await supabase.from('notes').upsert(rows, { onConflict: 'user_id,book_id', ignoreDuplicates: true })
    }

    // Highlights
    const lsHighlights = JSON.parse(localStorage.getItem('readgoods_highlights') || 'null')
    if (lsHighlights) {
      const rows = Object.entries(lsHighlights).flatMap(([book_id, hs]) =>
        hs.map(h => ({ user_id: userId, book_id, text: h.text, page: h.page, added_at: new Date(h.addedAt || Date.now()).toISOString() }))
      )
      if (rows.length) await supabase.from('highlights').insert(rows)
    }

    // Moods
    const lsMoods = JSON.parse(localStorage.getItem('readgoods_moods') || 'null')
    if (lsMoods) {
      const rows = Object.entries(lsMoods).map(([book_id, moods]) => ({ user_id: userId, book_id, moods }))
      if (rows.length) await supabase.from('moods').upsert(rows, { onConflict: 'user_id,book_id', ignoreDuplicates: true })
    }

    // Reading log
    const lsLog = JSON.parse(localStorage.getItem('readgoods_reading_log') || 'null')
    if (lsLog) {
      const rows = Object.entries(lsLog).map(([book_id, e]) => ({
        user_id: userId, book_id,
        page_count: e.totalPages || null,
        start_date: e.startDate ? new Date(e.startDate).toISOString() : null,
        finish_date: e.finishDate ? new Date(e.finishDate).toISOString() : null,
        sessions: e.sessions || [],
      }))
      if (rows.length) await supabase.from('reading_log').upsert(rows, { onConflict: 'user_id,book_id', ignoreDuplicates: true })
    }

    // Goals
    const lsGoals = JSON.parse(localStorage.getItem('readgoods_goals') || 'null')
    if (lsGoals) {
      const rows = Object.entries(lsGoals).map(([year, target]) => ({ user_id: userId, year: parseInt(year), target }))
      if (rows.length) await supabase.from('goals').upsert(rows, { onConflict: 'user_id,year', ignoreDuplicates: true })
    }

    // Clear localStorage data now that it's safely in Supabase
    localStorage.removeItem('readgoods_shelves')
    localStorage.removeItem('readgoods_notes')
    localStorage.removeItem('readgoods_highlights')
    localStorage.removeItem('readgoods_moods')
    localStorage.removeItem('readgoods_reading_log')
    localStorage.removeItem('readgoods_goals')
    localStorage.setItem(migKey, '1')
  } catch (e) {
    console.warn('Migration error:', e)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null
      setUserId(u?.id || null)
      setUser(u)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null
      setUserId(u?.id || null)
      setUser(u)
      if (event === 'SIGNED_IN' && u) {
        await migrateLocalStorage(u.id)
        // Always clear localStorage on sign-in — data lives in Supabase now
        localStorage.removeItem('readgoods_shelves')
        localStorage.removeItem('readgoods_notes')
        localStorage.removeItem('readgoods_highlights')
        localStorage.removeItem('readgoods_moods')
        localStorage.removeItem('readgoods_reading_log')
        localStorage.removeItem('readgoods_goals')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signUpWithEmail(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    return error
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
