const KEY = 'readgoods_goals'

export function getGoals() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function getGoal(year) {
  return getGoals()[year] ?? null
}

export function setGoal(year, target) {
  const goals = getGoals()
  if (target) goals[year] = target
  else delete goals[year]
  localStorage.setItem(KEY, JSON.stringify(goals))
}
