import { supabase, getUserId } from './supabase'

const KEY = 'readgoods_goals'

function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }

export async function getGoal(year) {
  const uid = getUserId()
  if (!uid) return lsGet()[year] ?? null
  const { data } = await supabase.from('goals').select('target').eq('user_id', uid).eq('year', year).maybeSingle()
  return data?.target ?? null
}

export async function setGoal(year, target) {
  const uid = getUserId()
  if (!uid) {
    const goals = lsGet()
    if (target) goals[year] = target
    else delete goals[year]
    localStorage.setItem(KEY, JSON.stringify(goals))
    return
  }
  if (target) {
    await supabase.from('goals').upsert({ user_id: uid, year, target }, { onConflict: 'user_id,year' })
  } else {
    await supabase.from('goals').delete().eq('user_id', uid).eq('year', year)
  }
}
