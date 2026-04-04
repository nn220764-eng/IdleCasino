// localStorage save/load with rate-limiting (max 1 write/sec)

const SAVE_KEY = 'casino-save'
let lastSaveTime = 0

export function maybeSave(state) {
  const now = Date.now()
  if (now - lastSaveTime >= 1000) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    lastSaveTime = now
  }
}

export function forceSave(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  lastSaveTime = Date.now()
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
