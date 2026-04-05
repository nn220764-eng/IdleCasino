// Coin management and offline income calculation

export function addCoins(state, amount) {
  state.coins += amount
}

export function calcOfflineIncome(state) {
  const now = Date.now()
  if (!state.lastActiveTime) {
    state.lastActiveTime = now
    return 0
  }

  const elapsedSec = Math.min((now - state.lastActiveTime) / 1000, 14400) // 4-hour cap
  const earned = Math.floor(elapsedSec * state.coinsPerSec)

  state.lastActiveTime = now
  return earned
}

// Update coinsPerSec based on table counts × expected value per table
export function updateCoinsPerSec(state, params) {
  const bjRate   = state.tables.bj       * (params.bj.bet * 0.005)      / (params.bj.interval / 1000)
  const slotRate = state.tables.slots    * (params.slots.bet * 0.05)     / (params.slots.interval / 1000)
  const rouRate  = state.tables.roulette * (
    (params.roulette.bet + params.roulette.cornerBet) * 0.027
  ) / (params.roulette.interval / 1000)

  state.coinsPerSec = bjRate + slotRate + rouRate
}
